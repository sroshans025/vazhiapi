"""
Layer 2 — Debt Category Classifier (Unit II)
============================================
Deep track : multi-filter 1D TextCNN (TensorFlow/Keras).
Serving    : hybrid of the TF-IDF logistic-regression model trained on the distress corpus
             and the curated category indicators from tn_context/debt_categories.json.
             Low-confidence inputs fall back to "general_financial_stress" instead of
             (as in v1) silently defaulting to blade finance.
"""
from __future__ import annotations

import re

import numpy as np

from core.config import get_settings
from models import lite
from nlp.preprocessor import TAMIL_CHAR, normalize_text
from tn_context import knowledge

settings = get_settings()

VOCAB_SIZE = 10000
EMBED_DIM = 128
MAX_LEN = 100
FILTER_SIZES = [2, 3, 4]
NUM_FILTERS = 128

DEBT_CATEGORIES = [c["id"] for c in knowledge.categories()]
NUM_CLASSES = len(DEBT_CATEGORIES)
CATEGORY_LABELS = {c["id"]: c["label"] for c in knowledge.categories()}
FALLBACK = "general_financial_stress"


def build_textcnn_model():
    from tensorflow import keras

    inputs = keras.Input(shape=(MAX_LEN,), dtype="int32", name="token_input")
    embedding = keras.layers.Embedding(VOCAB_SIZE, EMBED_DIM, name="embedding")(inputs)
    pools = []
    for fs in FILTER_SIZES:
        conv = keras.layers.Conv1D(NUM_FILTERS, fs, activation="relu", name=f"conv_{fs}")(embedding)
        pools.append(keras.layers.GlobalMaxPooling1D(name=f"pool_{fs}")(conv))
    x = keras.layers.Concatenate(name="concat")(pools)
    x = keras.layers.Dropout(0.5, name="dropout")(x)
    outputs = keras.layers.Dense(NUM_CLASSES, activation="softmax", name="category_output")(x)
    model = keras.Model(inputs=inputs, outputs=outputs, name="vazhiapi_textcnn")
    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    return model


def _indicator_scores(text: str) -> np.ndarray:
    norm = normalize_text(text)
    scores = np.zeros(NUM_CLASSES, dtype=np.float32)
    for i, cat in enumerate(knowledge.categories()):
        for kw in cat.get("indicators", []):
            k = normalize_text(kw)
            if not k:
                continue
            hit = (k in norm) if TAMIL_CHAR.search(k) else \
                re.search(rf"(?<![a-z0-9]){re.escape(k)}(?![a-z0-9])", norm) is not None
            if hit:
                scores[i] += 1.0 + 0.3 * (len(k.split()) - 1)   # multi-word phrases are stronger
    return scores


class TextCNNClassifier:
    def __init__(self):
        self.model = None
        self.backend = "keyword"

    def load(self, weights_path: str | None = None):
        if lite.get_bundle():
            self.backend = "sklearn-logreg+indicators"

    def predict(self, token_sequence: list, preprocessed: dict) -> dict:
        text = preprocessed.get("original") or preprocessed.get("normalized", "")
        ind = _indicator_scores(text)
        ind_probs = (ind / ind.sum()) if ind.sum() > 0 else np.zeros(NUM_CLASSES)

        learned = lite.predict_category_proba(text)
        if learned:
            lp = np.array([learned.get(c, 0.0) for c in DEBT_CATEGORIES], dtype=np.float32)
            probs = 0.5 * lp + 0.5 * ind_probs if ind.sum() > 0 else lp
        elif ind.sum() > 0:
            probs = ind_probs
        else:
            probs = np.zeros(NUM_CLASSES, dtype=np.float32)

        top = int(np.argmax(probs)) if probs.sum() > 0 else DEBT_CATEGORIES.index(FALLBACK)
        confidence = float(probs[top]) if probs.sum() > 0 else 0.0
        # No indicator support and a weak model vote → don't guess a specific trap.
        if ind.sum() == 0 and confidence < 0.35:
            top = DEBT_CATEGORIES.index(FALLBACK)
            probs = probs * 0.5
            probs[top] += 0.5
            confidence = float(probs[top])

        probs = probs / probs.sum()
        category = DEBT_CATEGORIES[top]
        ranked = sorted(range(NUM_CLASSES), key=lambda i: -probs[i])
        return {
            "debt_category": category,
            "debt_category_label": CATEGORY_LABELS[category],
            "confidence": round(float(probs[top]), 3),
            "probabilities": {DEBT_CATEGORIES[i]: round(float(probs[i]), 3) for i in ranked},
            "secondary_category": DEBT_CATEGORIES[ranked[1]] if probs[ranked[1]] > 0.2 else None,
            "model": f"Debt Classifier — {self.backend} (Unit II)",
        }
