"""Admin — counsellor analytics and escalation queue management"""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_admin, get_db
from database import crud
from database.models import UserSession

router = APIRouter(prefix="/admin")


def _esc_out(e) -> dict:
    return {
        "escalation_id": e.id,
        "user_id": e.user_id[:8] + "***",  # anonymised
        "reason": e.reason,
        "status": e.status,
        "assigned_to": e.assigned_to,
        "notes": e.notes,
        "created_at": crud.iso(e.created_at),
        "resolved_at": crud.iso(e.resolved_at),
    }


@router.get("/analytics")
async def admin_analytics(db: AsyncSession = Depends(get_db), current_admin=Depends(get_current_admin)):
    """Aggregated, anonymised stats across all users for the counsellor dashboard."""
    stats = await crud.get_aggregate_stats(db)
    rows = await db.execute(
        select(UserSession.debt_category, func.count(UserSession.id), func.avg(UserSession.stress_score))
        .group_by(UserSession.debt_category)
    )
    category_dist, avg_stress = {}, {}
    for cat, n, avg in rows:
        if cat:
            category_dist[cat] = n
            avg_stress[cat] = round(avg or 0, 1)

    crisis_rows = await db.execute(
        select(UserSession.crisis_level, func.count(UserSession.id)).group_by(UserSession.crisis_level))
    crisis_dist = {lvl or "unknown": n for lvl, n in crisis_rows}

    escalations = await crud.get_escalations(db, None, limit=50)
    return {
        **stats,
        "category_distribution": category_dist,
        "avg_stress_by_category": avg_stress,
        "crisis_distribution": crisis_dist,
        "escalation_queue": [_esc_out(e) for e in escalations if e.status != "resolved"][:20],
        "recently_resolved": [_esc_out(e) for e in escalations if e.status == "resolved"][:10],
    }


class EscalationUpdate(BaseModel):
    status: Literal["pending", "in_review", "resolved"] | None = None
    assigned_to: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


@router.patch("/escalations/{escalation_id}")
async def update_escalation(escalation_id: str, payload: EscalationUpdate, db: AsyncSession = Depends(get_db),
                            current_admin=Depends(get_current_admin)):
    esc = await crud.get_escalation(db, escalation_id)
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    if payload.status:
        esc.status = payload.status
        esc.resolved_at = datetime.now(timezone.utc) if payload.status == "resolved" else None
        if payload.status == "in_review" and not esc.assigned_to and not payload.assigned_to:
            esc.assigned_to = current_admin.full_name or current_admin.email
    if payload.assigned_to is not None:
        esc.assigned_to = payload.assigned_to
    if payload.notes is not None:
        esc.notes = payload.notes
    await db.commit()
    await db.refresh(esc)
    return _esc_out(esc)
