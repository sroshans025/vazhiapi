"""
VazhiAPI — Backend Test Suite (pytest + httpx ASGI client, isolated temp DB)
"""
import json

import pytest

from tests.conftest import make_user

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "healthy"
    assert len(d["pipeline_layers"]) == 6
    assert d["knowledge_base"]["schemes"] >= 20
    assert d["knowledge_base"]["districts"] == 38
    assert d["chat_engine"] == "vazhi-local"


async def test_register_validation_and_login(client):
    r = await client.post("/auth/register", json={"email": "bad", "password": "x", "full_name": "", "district": ""})
    assert r.status_code == 422
    u = await make_user(client, "Mixed@Case.com")
    dup = await client.post("/auth/register", json={"email": "mixed@case.com", "password": "password123",
                                                    "full_name": "A", "district": "Salem"})
    assert dup.status_code == 400
    r = await client.post("/auth/login", json={"email": "MIXED@case.com", "password": "password123"})
    assert r.status_code == 200 and r.json()["is_admin"] is False
    bad = await client.post("/auth/login", json={"email": "mixed@case.com", "password": "wrong-pass"})
    assert bad.status_code == 401
    me = await client.get("/auth/me", headers=u["h"])
    assert me.json()["district"] == "Madurai"


async def test_auth_required(client):
    assert (await client.post("/analyse", json={"text": "hi"})).status_code == 401
    assert (await client.get("/auth/me", headers={"Authorization": "Bearer junk"})).status_code == 401


async def test_analyse_categories_and_history_order(client):
    u = await make_user(client, "analyse@test.com")
    cases = {
        "I took kandhu vatti loan and the interest is more than the principal now": "blade_finance",
        "an instant loan app is calling my contacts and sending morphed photos": "loan_app_harassment",
        "my gold loan is overdue and the bank sent an auction notice": "gold_loan_overdue",
        "மகளின் திருமணத்திற்கு பலரிடம் கடன் வாங்கினேன்": "wedding_debt",
    }
    for text, cat in cases.items():
        r = await client.post("/analyse", json={"text": text, "include_debug": True}, headers=u["h"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["debt_category"] == cat, (text, d["debt_category"])
        assert 0 <= d["stress_score"] <= 100
        assert d["session_id"] and d["pipeline_debug"]
        assert d["matched_schemes"]
    # trajectory must be computed on chronological history ending with the newest score
    assert d["stress_history"][-1] == d["stress_score"]


async def test_language_and_crisis(client):
    u = await make_user(client, "crisis@test.com")
    r = (await client.post("/analyse", json={"text": "my crop failed and I don't want to live anymore"}, headers=u["h"])).json()
    assert r["crisis"]["level"] == "critical" and r["rl_action"] == "escalate" and r["stress_score"] >= 85
    assert "14416" in r["refined_response"]
    en = (await client.post("/analyse", json={"text": "my credit card bill keeps growing"}, headers=u["h"])).json()
    assert en["language"] == "en" and not any("஀" <= ch <= "௿" for ch in en["refined_response"].split("வழி")[0])
    # v1 false positive: "physical" alone used to trigger a severe crisis
    calm = (await client.post("/analyse", json={"text": "I need money for a physical exam fee"}, headers=u["h"])).json()
    assert calm["crisis"]["level"] == "low"


async def test_chat_multiturn_and_conversations(client):
    u = await make_user(client, "chat@test.com")
    r = await client.post("/chat", json={"message": "vanakkam"}, headers=u["h"])
    assert r.status_code == 200, r.text
    d = r.json()
    conv = d["conversation_id"]
    assert d["engine"] == "vazhi-local" and d["suggestions"]
    assert "Vanakkam" in d["response"] or "வணக்கம்" in d["response"]

    r2 = (await client.post("/chat", json={"message": "I pay 10% per week to a moneylender", "conversation_id": conv},
                            headers=u["h"])).json()
    assert "520%" in r2["response"]                       # 10% × 52 weeks
    r3 = (await client.post("/chat", json={"message": "which government schemes can help me?", "conversation_id": conv},
                            headers=u["h"])).json()
    assert "📞" in r3["response"]

    lst = (await client.get("/chat/conversations", headers=u["h"])).json()
    assert lst["conversations"][0]["id"] == conv and lst["conversations"][0]["message_count"] == 6
    full = (await client.get(f"/chat/conversations/{conv}", headers=u["h"])).json()
    assert [m["role"] for m in full["messages"]] == ["user", "assistant"] * 3

    other = await make_user(client, "other@test.com")
    assert (await client.get(f"/chat/conversations/{conv}", headers=other["h"])).status_code == 404
    assert (await client.patch(f"/chat/conversations/{conv}", json={"title": "Vatti"}, headers=u["h"])).json()["title"] == "Vatti"
    assert (await client.delete(f"/chat/conversations/{conv}", headers=u["h"])).status_code == 204


async def test_chat_stream_sse(client):
    u = await make_user(client, "stream@test.com")
    events = []
    async with client.stream("POST", "/chat/stream", json={"message": "loan app is threatening my family"},
                             headers=u["h"]) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        body = ""
        async for chunk in resp.aiter_text():
            body += chunk
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    kinds = [e for e, _ in events]
    assert kinds[0] == "meta" and kinds[1] == "analysis" and kinds[-1] == "done" and "delta" in kinds
    text = "".join(d["text"] for e, d in events if e == "delta")
    assert "1930" in text
    assert events[-1][1]["message"]["content"] == text.strip()


async def test_feedback_by_session_and_request_id(client):
    u = await make_user(client, "fb@test.com")
    a = (await client.post("/analyse", json={"text": "chit fund foreman ran away"}, headers=u["h"])).json()
    r = await client.post("/feedback", json={"session_id": a["session_id"], "rating": 1}, headers=u["h"])
    assert r.status_code == 200 and r.json()["rl_reward"] == 10
    r = await client.post("/feedback", json={"request_id": a["request_id"], "rating": -1}, headers=u["h"])
    assert r.status_code == 200 and r.json()["feedback_id"]          # upsert, same session
    assert (await client.post("/feedback", json={"session_id": "nope", "rating": 1}, headers=u["h"])).status_code == 404
    assert (await client.post("/feedback", json={"session_id": a["session_id"], "rating": 5}, headers=u["h"])).status_code == 422
    other = await make_user(client, "fb2@test.com")
    assert (await client.post("/feedback", json={"session_id": a["session_id"], "rating": 1}, headers=other["h"])).status_code == 404


async def test_escalation_authz_and_admin(client):
    u = await make_user(client, "esc@test.com")
    other = await make_user(client, "esc2@test.com")
    assert (await client.post(f"/escalate/{other['id']}", json={}, headers=u["h"])).status_code == 403
    r1 = (await client.post(f"/escalate/{u['id']}", json={"reason": "need help"}, headers=u["h"])).json()
    r2 = (await client.post(f"/escalate/{u['id']}", json={}, headers=u["h"])).json()
    assert r1["escalation_id"] == r2["escalation_id"] and r2["already_open"]

    assert (await client.get("/admin/analytics", headers=u["h"])).status_code == 403
    login = (await client.post("/auth/login", json={"email": "admin@vazhiapi.in", "password": "adminpass123"})).json()
    ah = {"Authorization": f"Bearer {login['access_token']}"}
    assert login["is_admin"]
    stats = (await client.get("/admin/analytics", headers=ah)).json()
    assert stats["total_users"] >= 2 and stats["escalation_queue"]
    upd = await client.patch(f"/admin/escalations/{r1['escalation_id']}", json={"status": "resolved", "notes": "called"}, headers=ah)
    assert upd.json()["status"] == "resolved" and upd.json()["resolved_at"]


async def test_dashboard_history_risk_summary_debug(client):
    u = await make_user(client, "dash@test.com")
    empty = (await client.get(f"/dashboard/summary/{u['id']}", headers=u["h"])).json()
    assert empty["has_data"] is False
    for t in ["gold loan overdue auction notice", "gold loan auction next week, I cannot repay and they are threatening"]:
        a = (await client.post("/analyse", json={"text": t}, headers=u["h"])).json()
    d = (await client.get(f"/dashboard/summary/{u['id']}", headers=u["h"])).json()
    assert d["has_data"] and d["session_count"] == 2 and d["stress_trend"][-1]["date"].endswith("Z")
    assert (await client.get(f"/history/{u['id']}", headers=u["h"])).json()["session_count"] == 2
    assert (await client.get(f"/risk/{u['id']}", headers=u["h"])).json()["trend"] in ("rising", "stable", "declining")
    assert "counsellor_notes" in (await client.get(f"/summary/{u['id']}", headers=u["h"])).json()
    dbg = (await client.get(f"/pipeline/debug/{a['request_id']}", headers=u["h"])).json()
    assert dbg["summary"]["stress_score"] == a["stress_score"]        # stored, not re-run
    other = await make_user(client, "dash2@test.com")
    assert (await client.get(f"/history/{u['id']}", headers=other["h"])).status_code == 403


async def test_public_knowledge_schemes_tools_demo(client):
    s = (await client.get("/schemes?category=agricultural_debt")).json()
    assert any(x["id"] == "pm_kisan" for x in s["schemes"])
    m = (await client.post("/schemes/match", json={"gender": "female", "annual_income": 100000, "occupation": "farmer"})).json()
    assert m["schemes"][0]["match_score"] >= m["schemes"][-1]["match_score"]
    assert not any(x["id"] == "tamil_pudhalvan" for x in m["schemes"])  # male-only scheme excluded
    assert len((await client.get("/knowledge/categories")).json()["categories"]) == 12
    assert (await client.get("/knowledge/categories/loan_app_harassment")).json()["laws"]
    assert "Tiruvannamalai" in (await client.get("/knowledge/districts")).json()["districts"]

    i = (await client.post("/tools/interest", json={"rate": 10, "period": "week", "principal": 10000, "months": 6})).json()
    assert i["simple_annual_rate"] == 520 and i["likely_illegal_private_lending"]
    e = (await client.post("/tools/emi", json={"principal": 100000, "annual_rate": 12, "months": 12})).json()
    assert 8880 <= e["emi"] <= 8890
    p = (await client.post("/tools/payoff", json={"monthly_budget": 9000, "strategy": "avalanche", "debts": [
        {"name": "vatti", "balance": 30000, "annual_rate": 120, "min_payment": 2000},
        {"name": "card", "balance": 50000, "annual_rate": 42, "min_payment": 2500}]})).json()
    assert p["payoff_order"][0] == "vatti" and p["total_interest"] <= p["comparison"]["total_interest"]

    b = (await client.post("/budget-plan", json={"monthly_income": 25000, "debt_emi": 12000, "debt_category": "blade_finance", "num_dependents": 3})).json()
    assert b["emi_to_income_ratio"] == 48.0 and b["status"] == "distressed"
    alloc = b["budget_allocation"]
    assert all(v >= 0 for v in alloc.values())
    assert abs(sum(alloc.values()) + b["shortfall"] - 25000) <= 2 or b["shortfall"] > 0

    demo = (await client.post("/demo/analyse", json={"text": "blade finance daily collection is killing me"})).json()
    assert demo["debt_category"] == "blade_finance" and "session_id" not in demo


async def test_delete_account(client):
    u = await make_user(client, "bye@test.com")
    await client.post("/chat", json={"message": "help with my wedding loans"}, headers=u["h"])
    assert (await client.delete("/auth/me", headers=u["h"])).status_code == 204
    assert (await client.get("/auth/me", headers=u["h"])).status_code == 401
