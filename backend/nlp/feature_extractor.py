"""
Feature Extractor — VazhiAPI
Converts preprocessed text dict into numeric feature vectors
consumed by L1 FFNN and L2 TextCNN.
"""
from typing import List, Dict
import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = None

def _get_vader():
    global _vader
    if _vader is None:
        _vader = SentimentIntensityAnalyzer()
    return _vader


# Feature dimension expected by FFNN (must match model input_dim)
FEATURE_DIM = 64

# Debt category vocabulary for basic BoW features
DEBT_VOCAB = [
    "blade", "vatti", "kuri", "chit", "gold", "thanga", "loan", "debt",
    "kadan", "kirushi", "kalyanam", "festival", "interest", "emi", "bank",
    "moneylender", "collector", "seized", "notice", "legal", "sue", "court",
    "salary", "income", "spend", "expense", "savings", "borrow", "lend",
    "வட்டி", "கடன்", "குறி", "தங்க", "கல்யாணம்", "கிருஷி", "வங்கி",
    "மாதம்", "பணம்", "செலவு", "சேமிப்பு", "நஷ்டம்", "தொல்லை",
    "வீடு", "நிலம்", "விவசாயம்", "மருந்து", "உணவு", "கல்வி",
    "திருமணம்", "அன்றாடம்", "தினம்", "வேலை", "வருமானம்", "சம்பளம்",
    "மாணவன்", "குடும்பம்", "பிள்ளை", "உதவி", "தீர்வு", "திட்டம்",
]


def bow_features(tokens: List[str], vocab: List[str]) -> np.ndarray:
    """Bag-of-words binary feature vector over given vocabulary."""
    token_set = set(t.lower() for t in tokens)
    return np.array([1.0 if w in token_set else 0.0 for w in vocab])


def extract_features(preprocessed: dict) -> np.ndarray:
    """
    Build 64-dimensional feature vector:
      [0]     urgency_score
      [1]     word_count (normalized 0-1)
      [2]     vader_compound
      [3]     vader_positive
      [4]     vader_negative
      [5]     vader_neutral
      [6]     has_tamil (1/0)
      [7]     num_financial_keywords (normalized)
      [8:56]  BoW over 48-word financial vocabulary (subset)
      [56:64] padding zeros
    """
    vader = _get_vader()
    vs = vader.polarity_scores(preprocessed["normalized"])

    base = np.array([
        preprocessed["urgency_score"],
        min(preprocessed["word_count"] / 200.0, 1.0),
        vs["compound"],
        vs["pos"],
        vs["neg"],
        vs["neu"],
        1.0 if preprocessed["language"] == "ta" else 0.0,
        min(len(preprocessed["financial_keywords"]) / 5.0, 1.0),
    ], dtype=np.float32)

    vocab_subset = DEBT_VOCAB[:48]
    bow = bow_features(preprocessed["tokens"], vocab_subset).astype(np.float32)

    features = np.concatenate([base, bow, np.zeros(8, dtype=np.float32)])
    assert features.shape == (FEATURE_DIM,), f"Expected {FEATURE_DIM} features, got {features.shape}"
    return features


def extract_text_sequence(preprocessed: dict, max_len: int = 100) -> List[int]:
    """
    Simple integer-encoded token sequence for CNN/RNN models.
    Uses a fixed vocabulary hash (char trigram hash → index 0-9999).
    """
    tokens = preprocessed["tokens"][:max_len]
    encoded = [abs(hash(t)) % 9999 + 1 for t in tokens]  # 1-indexed, 0 = PAD
    padded = encoded + [0] * (max_len - len(encoded))
    return padded
