"""GET /dashboard/summary/{user_id} — Aggregated widget-ready stats"""
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.risk import trend_of
from core.dependencies import ensure_self_or_admin, get_current_user, get_db
from database import crud
from tn_context import knowledge

router = APIRouter()


@router.get("/dashboard/summary/{user_id}")
async def dashboard_summary(user_id: str, db: AsyncSession = Depends(get_db),
                            current_user=Depends(get_current_user)):
    """One payload for the dashboard: trend, categories, current risk, matched schemes."""
    ensure_self_or_admin(current_user, user_id)
    sessions = await crud.get_user_sessions(db, user_id, limit=60)
    if not sessions:
        return {"user_id": user_id, "has_data": False, "stress_trend": [], "category_breakdown": {},
                "current_risk": None, "session_count": 0, "matched_schemes": knowledge.schemes()[:4]}

    scored = [s for s in sessions if s.stress_score is not None]
    categories = Counter(s.debt_category for s in sessions if s.debt_category)
    latest = sessions[0]
    scores = [s.stress_score for s in scored]
    primary = categories.most_common(1)[0][0] if categories else latest.debt_category
    cat = knowledge.category_map().get(primary, {})

    return {
        "user_id": user_id,
        "has_data": True,
        "stress_trend": [{"date": crud.iso(s.created_at), "score": s.stress_score, "category": s.debt_category}
                         for s in reversed(scored[:30])],
        "category_breakdown": dict(categories),
        "current_risk": {
            "score": latest.stress_score,
            "label": latest.stress_label,
            "category": latest.debt_category,
            "trajectory": latest.crisis_trajectory,
            "crisis_level": latest.crisis_level,
        },
        "trend": trend_of(scores),
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        "best_score": min(scores) if scores else None,
        "primary_category": primary,
        "primary_category_info": {k: cat.get(k) for k in ("label", "label_ta", "icon", "color", "first_steps", "first_steps_ta")},
        "matched_schemes": knowledge.schemes_for(primary, limit=4) or knowledge.schemes()[:4],
        "session_count": len(sessions),
        "last_session": crud.iso(latest.created_at),
    }
