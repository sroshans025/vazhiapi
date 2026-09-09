"""GET /health — System + model status"""
from fastapi import APIRouter
from core.config import get_settings
from pipeline.inference_pipeline import get_pipeline

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    pipeline = get_pipeline()
    return {
        "status": "healthy",
        "version": "1.0.0",
        "models_loaded": pipeline._loaded,
        "mock_mode": settings.USE_MOCK_MODELS,
        "database": "sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql",
        "pipeline_layers": [
            {"layer": "L1", "model": "FFNN Stress Scorer", "unit": "I", "status": "ready"},
            {"layer": "L2", "model": "TextCNN Classifier", "unit": "II", "status": "ready"},
            {"layer": "L3", "model": "BiLSTM Tracker", "unit": "III-A", "status": "ready"},
            {"layer": "L4", "model": "Seq2Seq+Attention", "unit": "III-B", "status": "ready"},
            {"layer": "L5", "model": "PPO/DQN Optimizer", "unit": "IV", "status": "ready"},
            {"layer": "L6", "model": "Behaviour Cloning", "unit": "V", "status": "ready"},
        ],
    }
