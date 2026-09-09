"""
NLP Preprocessor — VazhiAPI
Handles Tamil/English mixed-language text normalization
"""
import re
import unicodedata
from typing import List

# NLTK lazy-loaded
_nltk_ready = False

def _ensure_nltk():
    global _nltk_ready
    if _nltk_ready:
        return
    import nltk
    for pkg in ["punkt", "stopwords", "wordnet"]:
        try:
            nltk.download(pkg, quiet=True)
        except Exception:
            pass
    _nltk_ready = True


# Tamil Unicode range: \u0B80-\u0BFF
TAMIL_PATTERN = re.compile(r'[\u0B80-\u0BFF]+')

# Common Tamil financial stress keywords (transliterated + native)
TAMIL_FINANCIAL_KEYWORDS = {
    "blade": "blade_finance",
    "vatti": "high_interest",
    "வட்டி": "high_interest",
    "கடன்": "debt",
    "kadan": "debt",
    "chit": "chit_fund",
    "kuri": "chit_fund",
    "குறி": "chit_fund",
    "gold": "gold_loan",
    "thanga": "gold_loan",
    "தங்க": "gold_loan",
    "kirushi": "agricultural_debt",
    "கிருஷி": "agricultural_debt",
    "kalyanam": "wedding_debt",
    "கல்யாணம்": "wedding_debt",
    "habitual": "festival_credit",
    "festival": "festival_credit",
}

URGENCY_KEYWORDS = {
    "crisis": 3, "desperate": 3, "suicide": 5, "dying": 5, "cannot": 2,
    "helpless": 3, "trapped": 3, "no way out": 4, "மரணம்": 4, "உதவி": 2,
    "unable": 2, "lost": 2, "bankrupt": 3, "seized": 3, "threatening": 4,
    "harassment": 4, "தொல்லை": 3, "வேண்டும்": 1, "worry": 2, "scared": 2,
}


def detect_language(text: str) -> str:
    """Detect if text contains Tamil script."""
    tamil_chars = len(TAMIL_PATTERN.findall(text))
    return "ta" if tamil_chars > 0 else "en"


def normalize_text(text: str) -> str:
    """Lowercase, strip punctuation, normalize unicode."""
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r'[^\w\s\u0B80-\u0BFF]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def tokenize(text: str) -> List[str]:
    """Simple whitespace + basic tokenization."""
    _ensure_nltk()
    try:
        from nltk.tokenize import word_tokenize
        return word_tokenize(normalize_text(text))
    except Exception:
        return normalize_text(text).split()


def extract_financial_keywords(text: str) -> List[str]:
    """Return list of matched financial keyword categories from text."""
    normalized = normalize_text(text)
    found = []
    for keyword, category in TAMIL_FINANCIAL_KEYWORDS.items():
        if keyword.lower() in normalized:
            found.append(category)
    return list(set(found))


def extract_urgency_score(text: str) -> float:
    """
    Rule-based urgency score (0–1) from keyword presence.
    Supplements FFNN output during mock mode.
    """
    normalized = normalize_text(text)
    total = 0
    max_possible = 10
    for keyword, weight in URGENCY_KEYWORDS.items():
        if keyword.lower() in normalized:
            total += weight
    return min(total / max_possible, 1.0)


def preprocess(text: str) -> dict:
    """
    Full preprocessing pipeline. Returns dict consumed by feature extractor.
    """
    language = detect_language(text)
    normalized = normalize_text(text)
    tokens = tokenize(text)
    keywords = extract_financial_keywords(text)
    urgency = extract_urgency_score(text)
    word_count = len(tokens)

    return {
        "original": text,
        "normalized": normalized,
        "language": language,
        "tokens": tokens,
        "word_count": word_count,
        "financial_keywords": keywords,
        "urgency_score": urgency,
    }
