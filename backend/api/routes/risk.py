"""GET /risk/{user_id} — Current stress score + trend"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import ensure_self_or_admin, get_current_user, get_db
from database import crud

router = APIRouter()


def trend_of(scores_newest_first: list[float], threshold: float = 5) -> str:
    """Compare the latest score against the average of the earlier ones."""
    if len(scores_newest_first) < 2:
        return "stable"
    latest, earlier = scores_newest_first[0], scores_newest_first[1:]
    avg = sum(earlier) / len(earlier)
    if latest > avg + threshold:
        return "rising"
    if latest < avg - threshold:
        return "declining"
    return "stable"


@router.get("/risk/{user_id}")
async def get_risk(user_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    ensure_self_or_admin(current_user, user_id)
    sessions = await crud.get_user_sessions(db, user_id, limit=10)
    if not sessions:
        return {"user_id": user_id, "current_score": None, "trend": "no_data"}
    latest = sessions[0]
    scores = [s.stress_score for s in sessions if s.stress_score is not None]
    return {
        "user_id": user_id,
        "current_score": latest.stress_score,
        "current_label": latest.stress_label,
        "current_category": latest.debt_category,
        "trend": trend_of(scores),
        "recent_scores": scores[:5],
        "last_checked": crud.iso(latest.created_at),
    }
