"""
VazhiAPI — Core Configuration
Reads from environment variables with sensible local dev defaults.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "VazhiAPI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "vazhiapi-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database — defaults to SQLite for local dev (zero config)
    DATABASE_URL: str = "sqlite+aiosqlite:///./vazhiapi.db"

    # Redis — defaults to fakeredis (in-memory, zero config)
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_FAKE_REDIS: bool = True

    # ML Pipeline
    USE_MOCK_MODELS: bool = True   # True = fast demo; False = load real weights
    MODEL_WEIGHTS_DIR: str = "./model_weights"

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://vazhiapi.vercel.app",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
