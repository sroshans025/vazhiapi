"""
Feature Extractor — VazhiAPI
Converts the preprocessed text dict into numeric feature vectors consumed by L1/L2.
"""
import zlib
from typing import List

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = None


def _get_vader():
    global _vader
    if _vader is None:
        _vader = SentimentIntensityAnalyzer()
    return _vader


FEATURE_DIM = 64  # must match the FFNN input_dim

DEBT_VOCAB = [
    "blade", "vatti", "kuri", "chit", "gold", "thanga", "loan", "debt",
    "kadan", "kirushi", "kalyanam", "festival", "interest", "emi", "bank",
    "moneylender", "collector", "seized", "notice", "legal", "sue", "court",
    "salary", "income", "spend", "expense", "savings", "borrow", "lend",
    "வட்டி", "கடன்", "குறி", "தங்க", "கல்யாணம்", "கிருஷி", "வங்கி",
    "மாதம்", "பணம்", "செலவு", "சேமிப்பு", "நஷ்டம்", "தொல்லை",
    "வீடு", "நிலம்", "விவசாயம்", "மருந்து", "உணவு",
]


def bow_features(tokens: List[str], vocab: List[str]) -> np.ndarray:
    token_set = {t.lower() for t in tokens}
    return np.array([1.0 if w in token_set else 0.0 for w in vocab])


def vader_scores(text: str) -> dict:
    return _get_vader().polarity_scores(text)


def extract_features(preprocessed: dict) -> np.ndarray:
    """
    64-dim feature vector:
      [0] urgency  [1] word_count/200  [2..5] VADER compound/pos/neg/neu
      [6] has_tamil  [7] #financial_keywords/5  [8:56] BoW (48 words)  [56:64] zeros
    """
    vs = vader_scores(preprocessed["normalized"])
    base = np.array([
        preprocessed["urgency_score"],
        min(preprocessed["word_count"] / 200.0, 1.0),
        vs["compound"], vs["pos"], vs["neg"], vs["neu"],
        1.0 if preprocessed["language"] == "ta" else 0.0,
        min(len(preprocessed["financial_keywords"]) / 5.0, 1.0),
    ], dtype=np.float32)
    bow = bow_features(preprocessed["tokens"], DEBT_VOCAB[:48]).astype(np.float32)
    bow = np.pad(bow, (0, 48 - len(bow)))  # fixed 48-dim block regardless of vocab length
    features = np.concatenate([base, bow, np.zeros(8, dtype=np.float32)])
    assert features.shape == (FEATURE_DIM,), f"Expected {FEATURE_DIM} features, got {features.shape}"
    return features


def stable_token_id(token: str, vocab_size: int = 9999) -> int:
    """Deterministic across processes (Python's hash() is salted per process — v1 bug)."""
    return zlib.crc32(token.encode("utf-8")) % vocab_size + 1


def extract_text_sequence(preprocessed: dict, max_len: int = 100) -> List[int]:
    tokens = preprocessed["tokens"][:max_len]
    encoded = [stable_token_id(t) for t in tokens]  # 1-indexed, 0 = PAD
    return encoded + [0] * (max_len - len(encoded))
