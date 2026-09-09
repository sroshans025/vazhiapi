"""POST /analyse — Full 6-Layer Pipeline Analysis"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from database import crud
from pipeline.inference_pipeline import get_pipeline

router = APIRouter()


class AnalyseRequest(BaseModel):
    text: str
    language: str = "auto"   # "en" | "ta" | "auto"
    include_debug: bool = False


@router.post("/analyse")
async def analyse(
    payload: AnalyseRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Run the full 6-layer deep learning pipeline on a user's financial distress text.

    Returns stress score, debt category, trajectory, wellness response,
    RL intervention strategy, and (optionally) per-layer debug outputs.
    """
    # Fetch historical stress scores for BiLSTM context
    past_sessions = await crud.get_user_sessions(db, current_user.id, limit=10)
    stress_history = [s.stress_score for s in past_sessions if s.stress_score is not None]
    session_count = len(past_sessions) + 1

    pipeline = get_pipeline()
    result = pipeline.run(
        text=payload.text,
        stress_history=stress_history,
        session_count=session_count,
    )

    # Persist session to DB
    await crud.create_session(
        db,
        user_id=current_user.id,
        input_text=payload.text,
        language=result["language"],
        stress_score=result["stress_score"],
        stress_label=result["stress_label"],
        debt_category=result["debt_category"],
        debt_category_probabilities=result["debt_category_probabilities"],
        crisis_trajectory=result["crisis_trajectory"],
        predicted_peak_score=result["predicted_peak_score"],
        generated_response=result["generated_response"],
        attention_weights=result["attention_weights"],
        rl_action=result["rl_action"],
        rl_action_probabilities=result["rl_action_probabilities"],
        refined_response=result["refined_response"],
        request_id=result["request_id"],
        processing_time_ms=result["processing_time_ms"],
    )

    # Optionally strip debug data for smaller payload
    if not payload.include_debug:
        result.pop("pipeline_debug", None)

    return result
