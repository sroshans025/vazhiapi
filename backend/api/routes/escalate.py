"""POST /escalate/{user_id} — Human counsellor handoff"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import ensure_self_or_admin, get_current_user, get_db
from database import crud
from tn_context import knowledge

router = APIRouter()


class EscalateRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
    session_id: str | None = None


@router.post("/escalate/{user_id}")
async def escalate(user_id: str, payload: EscalateRequest, db: AsyncSession = Depends(get_db),
                   current_user=Depends(get_current_user)):
    """
    Flag a user for human counsellor follow-up. Users can only escalate themselves (v1 let anyone
    flag any user id); repeat requests reuse the open escalation instead of duplicating it.
    """
    ensure_self_or_admin(current_user, user_id)
    esc = await crud.get_open_escalation(db, user_id)
    created = esc is None
    if created:
        esc = await crud.create_escalation(db, user_id=user_id, session_id=payload.session_id,
                                           reason=payload.reason or "User requested human support")
    return {
        "escalation_id": esc.id,
        "status": esc.status,
        "already_open": not created,
        "message": "A counsellor has been notified and will reach out. If you need to talk right now, these helplines are free and confidential.",
        "helplines": {h["name"]: h["number"] for h in knowledge.helplines_for(["crisis", "stress"], 4)},
    }
