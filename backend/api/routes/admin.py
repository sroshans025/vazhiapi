"""GET /admin/analytics — Aggregated anonymized stats for counsellor dashboard"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.dependencies import get_db, get_current_admin
from database.models import UserSession, EscalationFlag
from database import crud

router = APIRouter()


@router.get("/admin/analytics")
async def admin_analytics(
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """
    Aggregated (anonymized) stats across all users for counsellor dashboard.
    """
    stats = await crud.get_aggregate_stats(db)

    # Category distribution
    category_rows = await db.execute(
        select(UserSession.debt_category, func.count(UserSession.id))
        .group_by(UserSession.debt_category)
    )
    category_dist = {row[0]: row[1] for row in category_rows if row[0]}

    # Avg stress by category
    stress_rows = await db.execute(
        select(UserSession.debt_category, func.avg(UserSession.stress_score))
        .group_by(UserSession.debt_category)
    )
    avg_stress = {row[0]: round(row[1], 1) for row in stress_rows if row[0]}

    # Pending escalations
    escalations = await crud.get_pending_escalations(db, limit=20)

    return {
        **stats,
        "category_distribution": category_dist,
        "avg_stress_by_category": avg_stress,
        "escalation_queue": [
            {
                "escalation_id": e.id,
                "user_id": e.user_id[:8] + "***",  # anonymize
                "reason": e.reason,
                "status": e.status,
                "created_at": e.created_at.isoformat(),
            }
            for e in escalations
        ],
    }
