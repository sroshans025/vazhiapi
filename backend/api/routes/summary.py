"""GET /summary/{user_id} — Counsellor-ready session summary"""
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.risk import trend_of
from core.dependencies import ensure_self_or_admin, get_current_user, get_db
from database import crud
from tn_context import knowledge

router = APIRouter()


@router.get("/summary/{user_id}")
async def get_summary(user_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    ensure_self_or_admin(current_user, user_id)
    sessions = await crud.get_user_sessions(db, user_id, limit=20)
    if not sessions:
        return {"user_id": user_id, "session_count": 0, "summary": "No sessions found"}

    scores = [s.stress_score for s in sessions if s.stress_score is not None]
    categories = Counter(s.debt_category for s in sessions if s.debt_category)
    actions = sorted({s.rl_action for s in sessions if s.rl_action})
    crises = sum(1 for s in sessions if s.crisis_level in ("critical", "severe"))

    dominant = categories.most_common(1)[0][0] if categories else "unknown"
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    trend = {"rising": "worsening", "declining": "improving"}.get(trend_of(scores), "stable")
    label = knowledge.category_map().get(dominant, {}).get("label", dominant)

    return {
        "user_id": user_id,
        "session_count": len(sessions),
        "date_range": {"first": crud.iso(sessions[-1].created_at), "last": crud.iso(sessions[0].created_at)},
        "stress_summary": {
            "average_score": avg_score,
            "peak_score": max(scores) if scores else 0,
            "current_score": scores[0] if scores else 0,
            "trend": trend,
        },
        "dominant_debt_category": dominant,
        "category_counts": dict(categories),
        "crisis_sessions": crises,
        "recommended_actions_given": actions,
        "counsellor_notes": (
            f"User has had {len(sessions)} sessions. Primary concern: {label}. "
            f"Average stress {avg_score}/100, trend {trend}. "
            + (f"{crises} session(s) with crisis/harassment flags. " if crises else "")
            + ("Immediate human follow-up recommended." if avg_score > 70 or crises else "Monitoring recommended.")
        ),
    }
