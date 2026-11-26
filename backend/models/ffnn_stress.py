"""
Layer 1 — Stress Scorer (Unit I)
================================
Deep track : 4-layer FFNN (TensorFlow/Keras) over the 64-dim feature vector.
Serving    : TF-IDF Ridge regressor trained on the VazhiAPI distress corpus, blended with
             interpretable signals (urgency lexicon, VADER negativity, crisis flags).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from core.config import get_settings
from models import lite

settings = get_settings()

INPUT_DIM = 64
HIDDEN_DIMS = [256, 128, 64]


def build_ffnn_model():
    """Keras FFNN used by training/train_ffnn.py (deep-learning track)."""
    from tensorflow import keras

    model = keras.Sequential([
        keras.layers.Input(shape=(INPUT_DIM,), name="feature_input"),
        keras.layers.Dense(256, activation="relu", name="hidden_1"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(128, activation="relu", name="hidden_2"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(64, activation="relu", name="hidden_3"),
        keras.layers.Dropout(0.1),
        keras.layers.Dense(1, activation="sigmoid", name="stress_output"),
    ], name="vazhiapi_ffnn_stress_scorer")
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=1e-3), loss="mse", metrics=["mae"])
    return model


def stress_label(score: float) -> str:
    if score >= 75:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 25:
        return "Moderate"
    return "Low"


class FFNNStressScorer:
    def __init__(self):
        self.model = None
        self.backend = "heuristic"

    def load(self, weights_path: str | None = None):
        weights_path = weights_path or str(Path(settings.MODEL_WEIGHTS_DIR) / "ffnn_stress.weights.h5")
        if not settings.USE_MOCK_MODELS and Path(weights_path).exists():
            try:
                self.model = build_ffnn_model()
                self.model.load_weights(weights_path)
                self.backend = "keras-ffnn"
                return
            except Exception:
                self.model = None
        if lite.get_bundle():
            self.backend = "tfidf-ridge"

    def predict(self, features: np.ndarray, preprocessed: dict) -> dict:
        urgency = float(preprocessed.get("urgency_score", 0.0))
        vader_neg = float(features[4]) if len(features) > 4 else 0.0
        vader_compound = float(features[2]) if len(features) > 2 else 0.0
        kw = len(preprocessed.get("financial_keywords", []))

        # Interpretable rule signal (0-100)
        rule = 12 + urgency * 55 + vader_neg * 35 + min(kw, 4) * 4 - max(vader_compound, 0) * 10
        rule = float(np.clip(rule, 3, 97))

        learned = None
        if self.model is not None:
            learned = float(self.model.predict(features.reshape(1, -1), verbose=0)[0][0]) * 100
        else:
            learned = lite.predict_stress(preprocessed.get("original") or preprocessed["normalized"])

        if learned is None:
            score = rule
        else:
            score = 0.6 * float(np.clip(learned, 0, 100)) + 0.4 * rule

        # Very short, non-financial small talk ("hi", "thanks") shouldn't read as distress.
        if preprocessed.get("word_count", 0) <= 3 and kw == 0 and urgency == 0:
            score = min(score, 15)

        score = float(np.clip(score, 1, 99))
        return {
            "stress_score": round(score, 1),
            "stress_label": stress_label(score),
            "top_keywords": preprocessed.get("financial_keywords", [])[:5],
            "components": {"learned": None if learned is None else round(learned, 1), "rule": round(rule, 1)},
            "model": f"Stress Scorer — {self.backend} (Unit I)",
        }
