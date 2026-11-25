"""POST /feedback — RL reward signal (thumbs up/down) on a counsellor reply"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from database import crud

router = APIRouter()


class FeedbackRequest(BaseModel):
    session_id: str | None = None     # UserSession.id (preferred)
    request_id: str | None = None     # or the pipeline request_id
    message_id: str | None = None
    rating: int = Field(description="1 = helpful, -1 = not helpful")
    comment: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _check(self):
        if self.rating not in (1, -1):
            raise ValueError("rating must be 1 or -1")
        if not (self.session_id or self.request_id):
            raise ValueError("session_id or request_id is required")
        return self


@router.post("/feedback")
async def submit_feedback(payload: FeedbackRequest, db: AsyncSession = Depends(get_db),
                          current_user=Depends(get_current_user)):
    """
    Thumbs up/down on a response — the reward signal for the PPO strategy agent (Unit IV).
    v1 accepted any id (the UI sent request_id as session_id) and allowed unlimited duplicates.
    """
    session = None
    if payload.session_id:
        session = await crud.get_session_by_id(db, payload.session_id)
    if session is None:
        session = await crud.get_session_by_request_id(db, payload.request_id or payload.session_id)
    if session is None or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    fb = await crud.upsert_feedback(db, current_user.id, session.id, payload.rating,
                                    payload.comment, payload.message_id)
    return {
        "feedback_id": fb.id,
        "session_id": session.id,
        "rating": fb.rating,
        "rl_reward": fb.rating * 10,
        "message": "Thank you! Your feedback helps improve the counsellor.",
    }
