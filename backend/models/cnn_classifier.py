"""
Layer 2 — 1D TextCNN Debt Category Classifier (Unit II)
========================================================
Architecture: Multi-filter 1D Convolutional Neural Network
Input:  Integer token sequence (max_len=100)
Output: 6-class probability distribution over TN debt categories

Filter sizes: [2, 3, 4] (unigram/bigram/trigram patterns)
Filters per size: 128
Pooling: Global max-pooling per filter bank

Framework: TensorFlow / Keras

Training: See backend/training/train_cnn.py
Datasets: Reddit r/personalfinanceindia + RBI Consumer Complaints
"""
from __future__ import annotations
import numpy as np
from core.config import get_settings

settings = get_settings()

VOCAB_SIZE = 10000
EMBED_DIM = 128
MAX_LEN = 100
NUM_CLASSES = 6
FILTER_SIZES = [2, 3, 4]
NUM_FILTERS = 128

DEBT_CATEGORIES = [
    "blade_finance",
    "chit_fund_default",
    "gold_loan_overdue",
    "agricultural_debt",
    "wedding_debt",
    "festival_credit",
]

CATEGORY_LABELS = {
    "blade_finance": "Blade Finance",
    "chit_fund_default": "Chit Fund Default",
    "gold_loan_overdue": "Gold Loan Overdue",
    "agricultural_debt": "Agricultural Debt",
    "wedding_debt": "Wedding Debt",
    "festival_credit": "Festival Credit",
}

# Keywords used in mock classification
CATEGORY_KEYWORDS = {
    "blade_finance": ["blade", "vatti", "ரொம்ப வட்டி", "daily collection", "100 to 120"],
    "chit_fund_default": ["chit", "kuri", "குறி", "chit fund", "company"],
    "gold_loan_overdue": ["gold", "thanga", "தங்க", "jewel", "pawned", "மணிக்கடை"],
    "agricultural_debt": ["kirushi", "கிருஷி", "farm", "crop", "harvest", "விவசாய"],
    "wedding_debt": ["kalyanam", "கல்யாணம்", "marriage", "wedding", "ceremony"],
    "festival_credit": ["festival", "pongal", "deepavali", "திருவிழா", "கொண்டாட்டம்"],
}


def build_textcnn_model():
    """Build 1D TextCNN with multi-filter architecture."""
    import tensorflow as tf
    from tensorflow import keras

    inputs = keras.Input(shape=(MAX_LEN,), dtype="int32", name="token_input")
    embedding = keras.layers.Embedding(VOCAB_SIZE, EMBED_DIM, name="embedding")(inputs)

    # Parallel convolutional branches — one per filter size
    conv_outputs = []
    for fs in FILTER_SIZES:
        conv = keras.layers.Conv1D(NUM_FILTERS, fs, activation="relu", name=f"conv_{fs}")(embedding)
        pool = keras.layers.GlobalMaxPooling1D(name=f"pool_{fs}")(conv)
        conv_outputs.append(pool)

    concatenated = keras.layers.Concatenate(name="concat")(conv_outputs)
    dropout = keras.layers.Dropout(0.5, name="dropout")(concatenated)
    outputs = keras.layers.Dense(NUM_CLASSES, activation="softmax", name="category_output")(dropout)

    model = keras.Model(inputs=inputs, outputs=outputs, name="vazhiapi_textcnn")
    model.compile(
        optimizer="adam",
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


class TextCNNClassifier:
    """
    L2 — TN Debt Category Classifier.
    Mock mode: keyword-matching heuristic.
    Production: real CNN softmax probabilities.
    """

    def __init__(self):
        self.model = None
        self._mock = settings.USE_MOCK_MODELS

    def load(self, weights_path: str = None):
        if self._mock:
            return
        import tensorflow as tf
        self.model = build_textcnn_model()
        if weights_path:
            self.model.load_weights(weights_path)

    def predict(self, token_sequence: list, preprocessed: dict) -> dict:
        if self._mock:
            return self._mock_predict(preprocessed)

        x = np.array([token_sequence])
        probs = self.model.predict(x, verbose=0)[0]
        return self._format_output(probs)

    def _mock_predict(self, preprocessed: dict) -> dict:
        """Heuristic classification using keyword matching."""
        text = preprocessed.get("normalized", "")
        scores = np.ones(NUM_CLASSES, dtype=np.float32) * 0.05  # base prior

        for i, category in enumerate(DEBT_CATEGORIES):
            kw_list = CATEGORY_KEYWORDS.get(category, [])
            for kw in kw_list:
                if kw.lower() in text:
                    scores[i] += 0.3

        # Normalize to probabilities
        probs = scores / scores.sum()
        return self._format_output(probs)

    def _format_output(self, probs: np.ndarray) -> dict:
        top_idx = int(np.argmax(probs))
        category = DEBT_CATEGORIES[top_idx]
        return {
            "debt_category": category,
            "debt_category_label": CATEGORY_LABELS[category],
            "confidence": round(float(probs[top_idx]), 3),
            "probabilities": {
                DEBT_CATEGORIES[i]: round(float(p), 3)
                for i, p in enumerate(probs)
            },
            "model": "TextCNN (Unit II)",
        }
