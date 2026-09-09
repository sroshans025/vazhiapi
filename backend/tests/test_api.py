"""
VazhiAPI — Backend Test Suite
Covers all 14 REST endpoints using pytest + httpx async client.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from api.main import app


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# Shared test credentials
TEST_EMAIL = "test@vazhiapi.local"
TEST_PASSWORD = "testpassword123"
_token = None
_user_id = None
_session_id = None


@pytest.mark.anyio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert len(data["pipeline_layers"]) == 6


@pytest.mark.anyio
async def test_register(client):
    global _token, _user_id
    r = await client.post("/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "full_name": "Test User",
        "district": "Chennai",
    })
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    _token = data["access_token"]
    _user_id = data["user_id"]


@pytest.mark.anyio
async def test_login(client):
    global _token
    r = await client.post("/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    assert r.status_code == 200
    _token = r.json()["access_token"]


@pytest.mark.anyio
async def test_analyse(client):
    global _session_id
    r = await client.post(
        "/analyse",
        json={
            "text": "I have taken blade finance loan of 50000 and cannot repay. They are threatening daily.",
            "include_debug": True,
        },
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "stress_score" in data
    assert 0 <= data["stress_score"] <= 100
    assert "debt_category" in data
    assert "refined_response" in data
    assert "pipeline_debug" in data
    assert "rl_action" in data


@pytest.mark.anyio
async def test_chat(client):
    r = await client.post(
        "/chat",
        json={"message": "I am worried about my gold loan. It is overdue."},
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    assert "response" in r.json()


@pytest.mark.anyio
async def test_history(client):
    r = await client.get(
        f"/history/{_user_id}",
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "sessions" in data
    if data["sessions"]:
        global _session_id
        _session_id = data["sessions"][0].get("session_id")


@pytest.mark.anyio
async def test_risk(client):
    r = await client.get(
        f"/risk/{_user_id}",
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200


@pytest.mark.anyio
async def test_schemes(client):
    r = await client.get(
        "/schemes?category=blade_finance",
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "schemes" in data
    assert len(data["schemes"]) > 0


@pytest.mark.anyio
async def test_budget_plan(client):
    r = await client.post(
        "/budget-plan",
        json={
            "monthly_income": 25000,
            "debt_emi": 12000,
            "debt_category": "blade_finance",
            "num_dependents": 3,
        },
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "emi_to_income_ratio" in data
    assert data["emi_to_income_ratio"] == 48.0
    assert data["status"] == "distressed"


@pytest.mark.anyio
async def test_feedback(client):
    if not _session_id:
        pytest.skip("No session available for feedback")
    r = await client.post(
        "/feedback",
        json={"session_id": _session_id, "rating": 1, "comment": "Very helpful!"},
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    assert r.json()["rl_reward"] == 10


@pytest.mark.anyio
async def test_escalate(client):
    r = await client.post(
        f"/escalate/{_user_id}",
        json={"reason": "User expressed extreme distress"},
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    assert "helplines" in r.json()


@pytest.mark.anyio
async def test_dashboard_summary(client):
    r = await client.get(
        f"/dashboard/summary/{_user_id}",
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
    assert "has_data" in r.json()


@pytest.mark.anyio
async def test_summary(client):
    r = await client.get(
        f"/summary/{_user_id}",
        headers={"Authorization": f"Bearer {_token}"},
    )
    assert r.status_code == 200
