"""
Layer 1 — FFNN Stress Scorer (Unit I)
===================================================
Architecture: 4-layer Feed-Forward Neural Network
Input:  64-dim feature vector (urgency, VADER, BoW)
Output: Stress score 0–100 (continuous regression)

Framework: TensorFlow / Keras

Training: See backend/training/train_ffnn.py
Dataset:  FinancialPhraseBank (Kaggle) + augmented TN distress texts
"""
from __future__ import annotations
import numpy as np
from core.config import get_settings

settings = get_settings()

INPUT_DIM = 64
HIDDEN_DIMS = [256, 128, 64]
OUTPUT_DIM = 1  # stress score 0–100


def build_ffnn_model():
    """
    Builds the FFNN architecture.
    Returns a compiled Keras Sequential model.
    """
    import tensorflow as tf
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
        keras.layers.Dense(1, activation="sigmoid", name="stress_output"),  # → *100
    ], name="vazhiapi_ffnn_stress_scorer")

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="mse",
        metrics=["mae"],
    )
    return model


class FFNNStressScorer:
    """
    L1 — FFNN Stress Scorer.
    In USE_MOCK_MODELS mode: returns deterministic score from urgency features.
    In production: loads saved Keras weights and runs real inference.
    """

    def __init__(self):
        self.model = None
        self._mock = settings.USE_MOCK_MODELS

    def load(self, weights_path: str = None):
        if self._mock:
            return
        import tensorflow as tf
        self.model = build_ffnn_model()
        if weights_path:
            self.model.load_weights(weights_path)

    def predict(self, features: np.ndarray, preprocessed: dict) -> dict:
        """
        Returns:
          score (float 0–100), label, top keywords
        """
        if self._mock:
            return self._mock_predict(features, preprocessed)

        # Real inference
        x = features.reshape(1, -1)
        raw = float(self.model.predict(x, verbose=0)[0][0])
        score = raw * 100
        return self._format_output(score, preprocessed)

    def _mock_predict(self, features: np.ndarray, preprocessed: dict) -> dict:
        """
        Deterministic mock inference.
        Uses urgency_score + VADER negative + keyword count to derive a
        realistic stress score without GPU.
        """
        urgency = preprocessed.get("urgency_score", 0.0)
        vader_neg = float(features[4]) if len(features) > 4 else 0.0
        kw_count = len(preprocessed.get("financial_keywords", []))

        # Composite formula mirroring what a trained FFNN would learn
        base = (urgency * 50) + (vader_neg * 30) + (kw_count * 5)
        # Add deterministic noise based on word hash
        seed = sum(ord(c) for c in preprocessed.get("normalized", "")[:20]) % 20
        score = min(max(base + seed, 5), 95)
        return self._format_output(score, preprocessed)

    def _format_output(self, score: float, preprocessed: dict) -> dict:
        if score >= 75:
            label = "Critical"
        elif score >= 50:
            label = "High"
        elif score >= 25:
            label = "Moderate"
        else:
            label = "Low"

        # Return top keywords that contributed (for L1 observability panel)
        top_kw = preprocessed.get("financial_keywords", [])[:5]

        return {
            "stress_score": round(score, 1),
            "stress_label": label,
            "top_keywords": top_kw,
            "model": "FFNN (Unit I)",
        }
