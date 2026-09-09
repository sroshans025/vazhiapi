"""GET /dashboard/summary/{user_id} — Aggregated widget-ready stats"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud

router = APIRouter()


@router.get("/dashboard/summary/{user_id}")
async def dashboard_summary(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Single aggregated payload for the wellness dashboard.
    Avoids frontend waterfall requests by combining history + risk + schemes in one call.
    """
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    sessions = await crud.get_user_sessions(db, user_id, limit=30)

    if not sessions:
        return {
            "user_id": user_id,
            "has_data": False,
            "stress_trend": [],
            "category_breakdown": {},
            "current_risk": None,
        }

    scores = [(s.created_at.isoformat(), s.stress_score) for s in sessions if s.stress_score]
    categories = [s.debt_category for s in sessions if s.debt_category]
    category_counts = {c: categories.count(c) for c in set(categories)}

    latest = sessions[0]
    return {
        "user_id": user_id,
        "has_data": True,
        "stress_trend": [{"date": d, "score": s} for d, s in reversed(scores[:20])],
        "category_breakdown": category_counts,
        "current_risk": {
            "score": latest.stress_score,
            "label": latest.stress_label,
            "category": latest.debt_category,
            "trajectory": latest.crisis_trajectory,
        },
        "session_count": len(sessions),
        "last_session": latest.created_at.isoformat(),
    }
