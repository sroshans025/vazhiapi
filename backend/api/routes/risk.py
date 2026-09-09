"""GET /risk/{user_id} — Current stress score + trend"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud

router = APIRouter()


@router.get("/risk/{user_id}")
async def get_risk(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    sessions = await crud.get_user_sessions(db, user_id, limit=10)
    if not sessions:
        return {"user_id": user_id, "risk_score": None, "trend": "No data"}

    latest = sessions[0]
    scores = [s.stress_score for s in sessions if s.stress_score is not None]
    trend = "stable"
    if len(scores) >= 2:
        if scores[0] > scores[-1] + 5:
            trend = "rising"
        elif scores[0] < scores[-1] - 5:
            trend = "declining"

    return {
        "user_id": user_id,
        "current_score": latest.stress_score,
        "current_label": latest.stress_label,
        "current_category": latest.debt_category,
        "trend": trend,
        "recent_scores": scores[:5],
        "last_checked": latest.created_at.isoformat(),
    }
