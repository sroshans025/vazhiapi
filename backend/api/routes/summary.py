"""GET /summary/{user_id} — Counsellor-ready session summary"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud

router = APIRouter()


@router.get("/summary/{user_id}")
async def get_summary(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    sessions = await crud.get_user_sessions(db, user_id, limit=20)
    if not sessions:
        return {"user_id": user_id, "summary": "No sessions found"}

    scores = [s.stress_score for s in sessions if s.stress_score]
    categories = [s.debt_category for s in sessions if s.debt_category]
    actions = [s.rl_action for s in sessions if s.rl_action]

    dominant_category = max(set(categories), key=categories.count) if categories else "unknown"
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    trend = "stable"
    if len(scores) >= 2:
        trend = "worsening" if scores[0] > scores[-1] else "improving"

    return {
        "user_id": user_id,
        "session_count": len(sessions),
        "date_range": {
            "first": sessions[-1].created_at.isoformat(),
            "last": sessions[0].created_at.isoformat(),
        },
        "stress_summary": {
            "average_score": avg_score,
            "peak_score": max(scores) if scores else 0,
            "current_score": scores[0] if scores else 0,
            "trend": trend,
        },
        "dominant_debt_category": dominant_category,
        "recommended_actions_given": list(set(actions)),
        "counsellor_notes": (
            f"User has had {len(sessions)} sessions. Primary concern: {dominant_category}. "
            f"Average stress: {avg_score}/100. Trend: {trend}. "
            f"{'Immediate human intervention recommended.' if avg_score > 70 else 'Monitoring recommended.'}"
        ),
    }
