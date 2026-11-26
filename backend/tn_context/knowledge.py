"""
Tamil Nadu knowledge base loader — schemes, debt categories, laws, helplines.
Loaded once and cached; small enough to keep in memory.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).resolve().parent

TN_DISTRICTS = [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
    "Erode", "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai",
    "Mayiladuthurai", "Nagapattinam", "Namakkal", "The Nilgiris", "Perambalur", "Pudukkottai",
    "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
    "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
    "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
]


def _load(name: str) -> dict:
    with open(_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache()
def schemes() -> list[dict]:
    return sorted(_load("govt_schemes.json")["schemes"], key=lambda s: s.get("priority", 9))


@lru_cache()
def categories() -> list[dict]:
    return _load("debt_categories.json")["categories"]


@lru_cache()
def category_map() -> dict[str, dict]:
    return {c["id"]: c for c in categories()}


@lru_cache()
def laws() -> list[dict]:
    return _load("legal_rights.json")["laws"]


@lru_cache()
def helplines() -> list[dict]:
    return _load("helplines.json")["helplines"]


@lru_cache()
def faq() -> list[dict]:
    return _load("faq.json")["entries"]


# ── Retrieval (BM25-lite over FAQ + schemes + laws + categories) ──────────────
import math
import re

_STOP = set("""a an the is are was were be been am i me my mine you your we our they them their he she it its of to in on
for with at by from as and or but if so do does did doing have has had can could should would will shall may might
what which who whom how when where why this that these those there here not no yes please tell about any some
get got give want need know also just very much more most than then too only into out up down over under again
enna epdi eppadi yen naan nan enaku ennaku irukku iruku panna pannanum sollunga""".split())


def _tokens(text: str) -> list[str]:
    out = []
    for t in re.findall(r"[஀-௿]+|[a-z0-9]+", text.lower()):
        if t in _STOP or len(t) < 2:
            continue
        if not re.match(r"[஀-௿]", t):
            for suf in ("ing", "ed", "es", "s"):
                if len(t) > 4 and t.endswith(suf):
                    t = t[: -len(suf)]
                    break
        out.append(t)
    return out


@lru_cache()
def _index() -> tuple[list[dict], list[dict[str, float]], dict[str, float]]:
    docs: list[dict] = []
    for e in faq():
        docs.append({"kind": "faq", "id": e["id"], "title": e["q"][0], "item": e,
                     "fields": [(" ".join(e["q"]), 3.0), (" ".join(e["kw"]), 3.0), (e["topic"], 1.5), (e["a"], 0.6)]})
    for s in schemes():
        docs.append({"kind": "scheme", "id": s["id"], "title": s["name"], "item": s,
                     "fields": [(s["name"] + " " + s["name_ta"], 3.0), (s["type"], 1.5), (s["description"] + " " + s["benefit"], 1.0)]})
    for l in laws():
        docs.append({"kind": "law", "id": l["id"], "title": l["name"], "item": l,
                     "fields": [(l["name"] + " " + l["name_ta"], 2.5), (l["summary"], 1.0), (" ".join(l["your_rights"]), 0.8)]})
    for c in categories():
        docs.append({"kind": "category", "id": c["id"], "title": c["label"], "item": c,
                     "fields": [(c["label"] + " " + c["label_ta"], 2.5), (" ".join(c["indicators"]), 2.0), (c["description"], 0.8)]})
    vecs: list[dict[str, float]] = []
    df: dict[str, int] = {}
    for d in docs:
        v: dict[str, float] = {}
        for text, w in d["fields"]:
            for t in _tokens(text):
                v[t] = v.get(t, 0.0) + w
        vecs.append(v)
        for t in v:
            df[t] = df.get(t, 0) + 1
    n = len(docs)
    idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}
    return docs, vecs, idf


def search(query: str, k: int = 4, kinds: tuple[str, ...] | None = None) -> list[dict]:
    """Return the top-k knowledge items for a free-text question with a relevance score."""
    docs, vecs, idf = _index()
    q = _tokens(query)
    if not q:
        return []
    scored = []
    for d, v in zip(docs, vecs):
        if kinds and d["kind"] not in kinds:
            continue
        s = 0.0
        for t in set(q):
            tf = v.get(t)
            if tf is None and len(t) >= 5:         # cheap prefix match (e.g. "insur" ~ "insurance")
                tf = next((val for key, val in v.items() if key.startswith(t[:5])), None)
                tf = tf * 0.5 if tf else None
            if tf:
                s += idf.get(t, 1.0) * (tf * 2.2) / (tf + 1.2)
        if s > 0:
            scored.append((s / (1 + 0.15 * len(set(q))), d))
    scored.sort(key=lambda x: -x[0])
    return [{"kind": d["kind"], "id": d["id"], "title": d["title"], "score": round(s, 3), "item": d["item"]} for s, d in scored[:k]]


def schemes_for(category: str, limit: int | None = None) -> list[dict]:
    out = [s for s in schemes() if category in s.get("applicable_categories", [])]
    return out[:limit] if limit else out


def laws_for(category: str) -> list[dict]:
    return [l for l in laws() if category in l.get("categories", [])]


def helplines_for(tags: list[str], limit: int = 4) -> list[dict]:
    tagset = set(tags)
    scored = [(len(tagset & set(h["for"])), h) for h in helplines()]
    scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: -x[0])
    return [h for _, h in scored[:limit]]


def match_schemes(profile: dict) -> list[dict]:
    """
    Rule-based eligibility matcher. `profile` keys (all optional):
      gender: male|female|other, age: int, annual_income: number,
      occupation: farmer|vendor|self_employed|daily_wage|salaried|student|homemaker|unemployed,
      community: general|obc|sc|st, student: bool, debt_category: str
    Returns schemes with a 0-100 match score and the reasons.
    """
    results = []
    gender = profile.get("gender")
    age = profile.get("age")
    income = profile.get("annual_income")
    occupation = profile.get("occupation")
    community = profile.get("community")
    student = bool(profile.get("student")) or occupation == "student"
    category = profile.get("debt_category")

    for s in schemes():
        c = s.get("criteria", {})
        score, reasons, blockers = 50, [], []

        if "gender" in c:
            if gender == c["gender"]:
                score += 15; reasons.append(f"For {c['gender']} applicants")
            elif gender and not (c.get("or_gender") == gender):
                blockers.append("gender")
        if "community" in c:
            if community in c["community"] or (c.get("or_gender") and gender == c["or_gender"]):
                score += 15; reasons.append("Matches community / gender priority")
            elif community or gender:
                blockers.append("community")
        if "max_income" in c and income is not None:
            if income <= c["max_income"]:
                score += 15; reasons.append(f"Income within ₹{c['max_income']:,} limit")
            else:
                blockers.append("income")
        if "min_age" in c and age is not None and age < c["min_age"]:
            blockers.append("age")
        if "max_age" in c and age is not None and age > c["max_age"]:
            blockers.append("age")
        if "occupation" in c:
            if occupation in c["occupation"]:
                score += 20; reasons.append("Matches your occupation")
            elif occupation:
                score -= 25
        if c.get("student"):
            if student:
                score += 20; reasons.append("For students")
            else:
                score -= 30
        if category and category in s.get("applicable_categories", []):
            score += 15; reasons.append("Relevant to your debt situation")

        if blockers:
            continue
        results.append({**s, "match_score": max(0, min(100, score)), "match_reasons": reasons})

    results.sort(key=lambda s: (-s["match_score"], s.get("priority", 9)))
    return results
