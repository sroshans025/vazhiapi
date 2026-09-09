"""POST /escalate/{user_id} — Human counsellor handoff"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud

router = APIRouter()


class EscalateRequest(BaseModel):
    reason: str | None = None
    session_id: str | None = None


@router.post("/escalate/{user_id}")
async def escalate(
    user_id: str,
    payload: EscalateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Flag a user for immediate human counsellor intervention.
    Triggered automatically when stress >= 85 or manually by user.
    """
    esc = await crud.create_escalation(
        db,
        user_id=user_id,
        session_id=payload.session_id,
        reason=payload.reason or "User requested human support",
    )
    return {
        "escalation_id": esc.id,
        "status": "pending",
        "message": "A certified counsellor has been notified and will contact you shortly.",
        "helplines": {
            "iCall": "9152987821",
            "Vandrevala Foundation": "1860-2662-345",
            "TN Legal Aid": "15100",
            "RBI Ombudsman": "14440",
        },
    }
