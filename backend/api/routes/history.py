"""GET /history/{user_id} — Full stress session history"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import ensure_self_or_admin, get_current_user, get_db
from database import crud

router = APIRouter()


@router.get("/history/{user_id}")
async def get_history(user_id: str, limit: int = Query(100, ge=1, le=500), db: AsyncSession = Depends(get_db),
                      current_user=Depends(get_current_user)):
    ensure_self_or_admin(current_user, user_id)
    sessions = await crud.get_user_sessions(db, user_id, limit=limit)
    return {
        "user_id": user_id,
        "session_count": len(sessions),
        "sessions": [
            {
                "session_id": s.id,
                "request_id": s.request_id,
                "conversation_id": s.conversation_id,
                "created_at": crud.iso(s.created_at),
                "input_preview": (s.input_text or "")[:120],
                "stress_score": s.stress_score,
                "stress_label": s.stress_label,
                "crisis_level": s.crisis_level,
                "debt_category": s.debt_category,
                "crisis_trajectory": s.crisis_trajectory,
                "rl_action": s.rl_action,
            }
            for s in sessions
        ],
    }
