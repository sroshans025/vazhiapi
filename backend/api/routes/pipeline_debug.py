"""GET /pipeline/debug/{request_id} — Per-layer intermediate outputs"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud
from pipeline.inference_pipeline import get_pipeline

router = APIRouter()


@router.get("/pipeline/debug/{request_id}")
async def pipeline_debug(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return per-layer intermediate outputs for a specific analysis request.
    Powers the Model Observability Panel in the frontend.

    Returns all 6 layer outputs:
    - L1 FFNN: stress score + top keywords
    - L2 TextCNN: category probabilities (bar chart data)
    - L3 BiLSTM: session trajectory (crisis trend line)
    - L4 Seq2Seq: attention heatmap over input tokens
    - L5 PPO/DQN: action distribution / Q-values
    - L6 Imitation: before/after tone comparison
    """
    session = await crud.get_session_by_request_id(db, request_id)
    if not session:
        raise HTTPException(status_code=404, detail="Request ID not found")

    if session.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    # Re-run pipeline on stored input to get full debug (since we stored compressed output)
    pipeline = get_pipeline()
    past_sessions = await crud.get_user_sessions(db, session.user_id, limit=10)
    stress_history = [
        s.stress_score for s in past_sessions
        if s.stress_score is not None and s.id != session.id
    ]

    result = pipeline.run(
        text=session.input_text,
        stress_history=stress_history,
        session_count=len(past_sessions),
    )

    return {
        "request_id": request_id,
        "input_text": session.input_text,
        "created_at": session.created_at.isoformat(),
        "pipeline_debug": result["pipeline_debug"],
        "summary": {
            "stress_score": result["stress_score"],
            "stress_label": result["stress_label"],
            "debt_category_label": result["debt_category_label"],
            "crisis_trajectory": result["crisis_trajectory"],
            "rl_action": result["rl_action"],
        },
    }
