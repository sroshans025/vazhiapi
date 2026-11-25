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
