"""POST /chat — Quick multilingual wellness response (no DB write)"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.dependencies import get_current_user
from pipeline.inference_pipeline import get_pipeline

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    language: str = "auto"


@router.post("/chat")
async def chat(payload: ChatRequest, current_user=Depends(get_current_user)):
    """
    Lightweight chat endpoint — runs L1+L2+L4+L6 only (skips BiLSTM history + RL).
    Returns a fast wellness response for the conversational UI.
    """
    pipeline = get_pipeline()
    result = pipeline.run(text=payload.message, stress_history=[], session_count=1)
    return {
        "response": result["refined_response"],
        "stress_score": result["stress_score"],
        "debt_category_label": result["debt_category_label"],
        "language": result["language"],
    }
