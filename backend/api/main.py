"""
VazhiAPI — FastAPI Application Entry Point
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from api.routes import (
    admin, analyse, auth, budget, chat, dashboard, demo, escalate, feedback, health, history,
    knowledge_routes, pipeline_debug, risk, schemes, summary, tools,
)
from core.config import get_settings
from database import crud
from database.session import async_session_maker, create_all_tables
from pipeline.inference_pipeline import get_pipeline

settings = get_settings()
logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vazhi")


async def _bootstrap_admin():
    if not (settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD):
        return
    async with async_session_maker() as db:
        user = await crud.get_user_by_email(db, settings.ADMIN_EMAIL)
        if user is None:
            await crud.create_user(db, settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD,
                                   full_name="VazhiAPI Admin", district="Chennai", is_admin=True)
            log.info("bootstrap admin created: %s", settings.ADMIN_EMAIL)
        elif not user.is_admin:
            user.is_admin = True
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_all_tables()
    await _bootstrap_admin()
    await run_in_threadpool(get_pipeline().load_models)   # trains lite models on first boot if missing
    yield


app = FastAPI(
    title="VazhiAPI — Tamil Nadu Financial Wellness Platform",
    description="""
## வழி — நம்ம பணம் நம்ம கையில்

Reads financial distress in your own words (English, Tamil, Tanglish), scores stress, classifies
12 Tamil Nadu debt traps, tracks trajectory, and counsels you through a multi-turn chat grounded in
24 government schemes, 14 laws and verified helplines.

### 6-Layer Pipeline
| Layer | Unit | Deep-learning track | Serving backend |
|---|---|---|---|
| L1 | I | FFNN stress scorer | TF-IDF Ridge + urgency/VADER signals |
| L2 | II | TextCNN classifier | TF-IDF LogReg + curated indicators |
| L3 | III-A | BiLSTM tracker | trend analysis |
| L4 | III-B | Seq2Seq + attention | knowledge-grounded composer |
| L5 | IV | PPO strategy agent | learned-policy rules |
| L6 | V | Behaviour cloning | counsellor tone rules |

Chat is powered by Claude when `ANTHROPIC_API_KEY` is set, otherwise by the built-in bilingual counsellor.
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)   # skips text/event-stream
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=settings.ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["System"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(analyse.router, tags=["Core Pipeline"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(demo.router, tags=["Public Demo"])
app.include_router(history.router, tags=["User Data"])
app.include_router(risk.router, tags=["User Data"])
app.include_router(summary.router, tags=["User Data"])
app.include_router(dashboard.router, tags=["User Data"])
app.include_router(schemes.router, tags=["Tamil Nadu Context"])
app.include_router(knowledge_routes.router, tags=["Tamil Nadu Context"])
app.include_router(budget.router, tags=["Tools"])
app.include_router(tools.router, tags=["Tools"])
app.include_router(feedback.router, tags=["RL Reward Loop"])
app.include_router(escalate.router, tags=["Crisis Management"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(pipeline_debug.router, tags=["Model Observability"])


@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": "VazhiAPI",
        "tagline": "நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
