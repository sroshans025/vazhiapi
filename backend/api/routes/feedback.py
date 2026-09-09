"""POST /feedback — RL reward signal (thumbs up/down)"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud

router = APIRouter()


class FeedbackRequest(BaseModel):
    session_id: str
    rating: int   # 1 = thumbs up (helpful), -1 = thumbs down (not helpful)
    comment: str | None = None


@router.post("/feedback")
async def submit_feedback(
    payload: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Submit thumbs up/down feedback on a generated response.
    This rating becomes a reward signal for the PPO/DQN agent (Unit IV).
    Negative feedback → agent learns to avoid that action in similar context.
    """
    if payload.rating not in (1, -1):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Rating must be 1 (positive) or -1 (negative)")

    fb = await crud.create_feedback(
        db,
        user_id=current_user.id,
        session_id=payload.session_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    return {
        "feedback_id": fb.id,
        "rating": payload.rating,
        "rl_reward": payload.rating * 10,   # scaled reward for PPO update
        "message": "Thank you! Your feedback helps improve the AI counsellor.",
    }
