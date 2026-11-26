"""
VazhiAPI — Core Configuration
Reads from environment variables (and backend/.env) with sensible local dev defaults.
"""
from functools import lru_cache
from pathlib import Path
import logging
import os
import tempfile

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
_DEV_SECRET = "vazhiapi-dev-secret-change-in-prod"

# Serverless platforms (Vercel / AWS Lambda) only allow writes under the temp dir.
IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
_DATA_DIR = Path(tempfile.gettempdir()) if IS_SERVERLESS else BACKEND_DIR

log = logging.getLogger("vazhi")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "VazhiAPI"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = _DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database — defaults to SQLite next to the backend (zero config)
    # On Vercel set DATABASE_URL to a Postgres URL (e.g. Neon from Vercel Storage); without it the
    # app falls back to SQLite in /tmp, which is wiped whenever the function instance recycles.
    DATABASE_URL: str = f"sqlite+aiosqlite:///{(_DATA_DIR / 'vazhiapi.db').as_posix()}"

    # ML Pipeline
    # True  = never load TensorFlow/PyTorch (fast, slim install). The pipeline still uses the
    #         trained scikit-learn "lite" models in MODEL_WEIGHTS_DIR when present.
    # False = additionally try to load TF/PyTorch weights for the deep layers.
    USE_MOCK_MODELS: bool = True
    MODEL_WEIGHTS_DIR: str = str(_DATA_DIR / "model_weights")

    # Chat — Claude (optional). When no Anthropic credentials are available the chat
    # falls back to the built-in bilingual counselling engine automatically.
    CHAT_LLM: str = "auto"            # "auto" | "anthropic" | "local"
    ANTHROPIC_MODEL: str = "claude-opus-5-5"
    CHAT_HISTORY_TURNS: int = 12      # past messages sent as context

    # Bootstrap admin (created/updated on startup when both are set)
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None

    # Public demo endpoint rate limit (requests per minute per IP)
    DEMO_RATE_LIMIT_PER_MIN: int = 20

    # CORS — allow localhost dev + Vercel deployments
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://vazhiapi.vercel.app",
    ]
    ALLOWED_ORIGIN_REGEX: str | None = r"https://vazhiapi.*\.vercel\.app"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        v = (v or "").strip()
        # Hosted Postgres providers hand out sync URLs; SQLAlchemy async needs a driver.
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        if v.startswith("sqlite:///"):
            v = "sqlite+aiosqlite:///" + v[len("sqlite:///"):]
        return v


@lru_cache()
def get_settings() -> Settings:
    if not os.environ.get("DATABASE_URL") and os.environ.get("POSTGRES_URL"):
        os.environ["DATABASE_URL"] = os.environ["POSTGRES_URL"]
    s = Settings()
    if IS_SERVERLESS and s.DATABASE_URL.startswith("sqlite"):
        log.warning("No DATABASE_URL set on a serverless host: using SQLite in the temp dir. "
                    "Accounts and chats will be lost when the instance recycles; connect a Postgres database.")
    if s.SECRET_KEY == _DEV_SECRET and not s.DEBUG:
        log.warning("SECRET_KEY is the development default — set SECRET_KEY in production.")
    return s
