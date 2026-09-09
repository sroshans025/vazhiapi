"""GET /schemes — TN government scheme matches by debt category"""
import json
import os
from fastapi import APIRouter, Depends, Query
from core.dependencies import get_current_user

router = APIRouter()

_SCHEMES_PATH = os.path.join(os.path.dirname(__file__), "../../tn_context/govt_schemes.json")

def _load_schemes():
    with open(_SCHEMES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["schemes"]


@router.get("/schemes")
async def get_schemes(
    category: str | None = Query(None, description="Filter by debt category"),
    current_user=Depends(get_current_user),
):
    schemes = _load_schemes()
    if category:
        schemes = [s for s in schemes if category in s.get("applicable_categories", [])]
    return {"schemes": schemes, "count": len(schemes)}
