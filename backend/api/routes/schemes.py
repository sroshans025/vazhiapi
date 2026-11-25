"""Schemes — list/filter/search, eligibility matcher, detail (public: this is public information)"""
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from tn_context import knowledge

router = APIRouter()


@router.get("/schemes")
async def get_schemes(
    category: str | None = Query(None, description="Filter by debt category id"),
    q: str | None = Query(None, max_length=80, description="Search name / description"),
    level: Literal["state", "central"] | None = None,
):
    schemes = knowledge.schemes()
    if category:
        schemes = [s for s in schemes if category in s.get("applicable_categories", [])]
    if level:
        schemes = [s for s in schemes if s.get("level") == level]
    if q:
        ql = q.lower()
        schemes = [s for s in schemes if ql in (s["name"] + s["description"] + s["type"] + s["name_ta"]).lower()]
    return {"schemes": schemes, "count": len(schemes), "total": len(knowledge.schemes())}


class MatchRequest(BaseModel):
    gender: Literal["male", "female", "other"] | None = None
    age: int | None = Field(default=None, ge=10, le=110)
    annual_income: float | None = Field(default=None, ge=0)
    occupation: Literal["farmer", "vendor", "self_employed", "daily_wage", "salaried",
                        "student", "homemaker", "unemployed"] | None = None
    community: Literal["general", "obc", "sc", "st"] | None = None
    student: bool | None = None
    debt_category: str | None = None


@router.post("/schemes/match")
async def match_schemes(profile: MatchRequest):
    """Rule-based eligibility matcher — ranks schemes by fit, with reasons."""
    results = knowledge.match_schemes(profile.model_dump(exclude_none=True))
    return {"schemes": results, "count": len(results)}


@router.get("/schemes/{scheme_id}")
async def get_scheme(scheme_id: str):
    for s in knowledge.schemes():
        if s["id"] == scheme_id:
            return s
    raise HTTPException(status_code=404, detail="Scheme not found")
