"""GET /history/{user_id} — Full stress session history"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud

router = APIRouter()


@router.get("/history/{user_id}")
async def get_history(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    sessions = await crud.get_user_sessions(db, user_id, limit=100)
    return {
        "user_id": user_id,
        "session_count": len(sessions),
        "sessions": [
            {
                "session_id": s.id,
                "request_id": s.request_id,
                "created_at": s.created_at.isoformat(),
                "stress_score": s.stress_score,
                "stress_label": s.stress_label,
                "debt_category": s.debt_category,
                "crisis_trajectory": s.crisis_trajectory,
                "rl_action": s.rl_action,
            }
            for s in sessions
        ],
    }
