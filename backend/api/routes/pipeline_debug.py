"""GET /pipeline/debug/{request_id} — Per-layer intermediate outputs"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from database import crud
from pipeline.inference_pipeline import get_pipeline

router = APIRouter()


@router.get("/pipeline/debug/{request_id}")
async def pipeline_debug(request_id: str, db: AsyncSession = Depends(get_db),
                         current_user=Depends(get_current_user)):
    """
    Per-layer outputs as stored when the analysis ran (v1 re-ran the pipeline, so the panel
    could disagree with what the user actually saw). Accepts a request_id or session_id.
    """
    session = await crud.get_session_by_request_id(db, request_id) or await crud.get_session_by_id(db, request_id)
    if not session:
        raise HTTPException(status_code=404, detail="Request ID not found")
    if session.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    debug = session.pipeline_debug
    if not debug:  # rows created before v2 — recompute once
        debug = (await run_in_threadpool(get_pipeline().run, session.input_text, [], 1))["pipeline_debug"]
    return {
        "request_id": session.request_id,
        "session_id": session.id,
        "input_text": session.input_text,
        "created_at": crud.iso(session.created_at),
        "pipeline_debug": debug,
        "summary": {
            "stress_score": session.stress_score,
            "stress_label": session.stress_label,
            "debt_category": session.debt_category,
            "crisis_trajectory": session.crisis_trajectory,
            "rl_action": session.rl_action,
        },
    }
