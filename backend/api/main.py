"""
VazhiAPI — FastAPI Application Entry Point
==========================================
14 REST endpoints covering the full 6-layer deep learning pipeline,
auth, user sessions, admin analytics, and model observability.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from core.config import get_settings
from database.session import create_all_tables
from pipeline.inference_pipeline import get_pipeline

from api.routes import (
    auth, analyse, chat, history, risk, schemes,
    budget, summary, feedback, escalate, health,
    dashboard, admin, pipeline_debug,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables + load ML models. Shutdown: cleanup."""
    # DB
    await create_all_tables()
    # ML Pipeline — load all 6 model layers
    pipeline = get_pipeline()
    pipeline.load_models()
    yield
    # Shutdown cleanup (none needed for mock models)


app = FastAPI(
    title="VazhiAPI — Tamil Nadu Financial Wellness Platform",
    description="""
## வழி — நம்ம பணம் நம்ம கையில்

An AI-powered platform that reads financial distress in your words,
scores your stress in real time, classifies Tamil Nadu-specific debt traps,
and matches you to the correct government scheme or legal aid path.

### 6-Layer Deep Learning Pipeline
| Layer | Unit | Model |
|---|---|---|
| L1 | Unit I | FFNN — Stress Scorer |
| L2 | Unit II | TextCNN — Debt Classifier |
| L3 | Unit III-A | BiLSTM — Session Tracker |
| L4 | Unit III-B | Seq2Seq+Attention — Response Generator |
| L5 | Unit IV | PPO/DQN — Strategy Optimizer |
| L6 | Unit V | Behaviour Cloning — Tone Refiner |

### Course: Applied Deep Learning (AM4502)
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────
app.include_router(health.router, tags=["System"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(analyse.router, tags=["Core Pipeline"])
app.include_router(chat.router, tags=["Core Pipeline"])
app.include_router(history.router, tags=["User Data"])
app.include_router(risk.router, tags=["User Data"])
app.include_router(schemes.router, tags=["Tamil Nadu Context"])
app.include_router(budget.router, tags=["Tamil Nadu Context"])
app.include_router(summary.router, tags=["User Data"])
app.include_router(feedback.router, tags=["RL Reward Loop"])
app.include_router(escalate.router, tags=["Crisis Management"])
app.include_router(dashboard.router, tags=["Frontend Support"])
app.include_router(admin.router, tags=["Admin Analytics"])
app.include_router(pipeline_debug.router, tags=["Model Observability"])


@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": "VazhiAPI",
        "tagline": "நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
