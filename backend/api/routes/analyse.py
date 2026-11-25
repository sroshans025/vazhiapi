"""POST /analyse — Full 6-Layer Pipeline Analysis"""
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from database import crud
from pipeline.inference_pipeline import get_pipeline

router = APIRouter()


class AnalyseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: str = "auto"
    include_debug: bool = False


async def run_and_store(db: AsyncSession, user, text: str, conversation_id: str | None = None) -> dict:
    """Run the pipeline with the user's chronological stress history and persist the session."""
    past = await crud.get_user_sessions(db, user.id, limit=10)          # newest first
    history = [s.stress_score for s in reversed(past) if s.stress_score is not None]  # oldest → newest
    result = await run_in_threadpool(get_pipeline().run, text, history, len(past) + 1)

    session = await crud.create_session(
        db,
        user_id=user.id,
        conversation_id=conversation_id,
        input_text=text,
        language=result["language"],
        stress_score=result["stress_score"],
        stress_label=result["stress_label"],
        crisis_level=result["crisis"]["level"],
        debt_category=result["debt_category"],
        debt_category_probabilities=result["debt_category_probabilities"],
        crisis_trajectory=result["crisis_trajectory"],
        predicted_peak_score=result["predicted_peak_score"],
        generated_response=result["generated_response"],
        attention_weights=result["attention_weights"],
        rl_action=result["rl_action"],
        rl_action_probabilities=result["rl_action_probabilities"],
        refined_response=result["refined_response"],
        pipeline_debug=result["pipeline_debug"],
        request_id=result["request_id"],
        processing_time_ms=result["processing_time_ms"],
    )
    result["session_id"] = session.id
    return result


@router.post("/analyse")
async def analyse(payload: AnalyseRequest, db: AsyncSession = Depends(get_db),
                  current_user=Depends(get_current_user)):
    """
    Run the full 6-layer pipeline on a user's financial distress text and save it as a check-in.
    Returns stress score, debt category, trajectory, response, strategy, matched schemes and helplines.
    """
    result = await run_and_store(db, current_user, payload.text)
    if not payload.include_debug:
        result.pop("pipeline_debug", None)
    return result
