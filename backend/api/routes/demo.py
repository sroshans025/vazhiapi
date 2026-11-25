"""POST /demo/analyse — public, rate-limited, nothing stored. Powers the landing-page live demo."""
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from core.config import get_settings
from pipeline.inference_pipeline import get_pipeline

router = APIRouter(prefix="/demo")
settings = get_settings()
_hits: dict[str, deque] = defaultdict(deque)


class DemoRequest(BaseModel):
    text: str = Field(min_length=1, max_length=600)


def _rate_limit(ip: str) -> None:
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= settings.DEMO_RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail="Too many demo requests — please wait a minute.")
    q.append(now)
    if len(_hits) > 5000:            # keep memory bounded
        _hits.clear()


@router.post("/analyse")
async def demo_analyse(payload: DemoRequest, request: Request):
    _rate_limit(request.client.host if request.client else "anon")
    r = await run_in_threadpool(get_pipeline().run, payload.text, [], 1)
    keep = ("stress_score", "stress_label", "debt_category", "debt_category_label", "debt_category_label_ta",
            "debt_category_icon", "debt_category_color", "debt_category_probabilities", "rl_action",
            "rl_action_label", "rl_action_description", "refined_response", "language", "crisis",
            "matched_schemes", "helplines", "processing_time_ms", "attention_weights")
    return {k: r[k] for k in keep}
