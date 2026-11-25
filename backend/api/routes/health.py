"""GET /health — System + model status"""
from fastapi import APIRouter

from counsel.engine import claude_available
from core.config import get_settings
from models import lite
from pipeline.inference_pipeline import get_pipeline
from tn_context import knowledge

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    pipeline = get_pipeline()
    bundle = lite.get_bundle()
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "models_loaded": pipeline._loaded,
        "mock_mode": settings.USE_MOCK_MODELS,
        "database": "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql",
        "chat_engine": "claude" if claude_available() else "vazhi-local",
        "lite_model_metrics": bundle.get("metrics") if bundle else None,
        "knowledge_base": {
            "schemes": len(knowledge.schemes()), "debt_categories": len(knowledge.categories()),
            "laws": len(knowledge.laws()), "helplines": len(knowledge.helplines()),
            "districts": len(knowledge.TN_DISTRICTS),
        },
        "pipeline_layers": [dict(l, status="ready") for l in pipeline.layer_status()],
    }
