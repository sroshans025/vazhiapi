"""
NLP Preprocessor — VazhiAPI
Handles Tamil / English / Tanglish (romanised Tamil) mixed-language text.

v2: pure-regex tokenisation (no NLTK downloads at request time — those hit the
network on every cold start and failed on new NLTK versions missing `punkt_tab`).
"""
import re
import unicodedata
from typing import List

# Tamil Unicode block: U+0B80–U+0BFF
TAMIL_CHAR = re.compile(r"[஀-௿]")
# Words = runs of letters/digits incl. Tamil combining marks
TOKEN_RE = re.compile(r"[஀-௿]+|[a-z0-9]+(?:'[a-z]+)?", re.IGNORECASE)

# Common romanised-Tamil words — used to detect Tanglish so we can answer in kind
TANGLISH_MARKERS = {
    "enna", "ennaku", "enakku", "naan", "nan", "illa", "illai", "irukku", "iruku", "panna",
    "pannanum", "mudiyala", "mudiyathu", "kadan", "vatti", "panam", "kasu", "romba", "konjam",
    "epdi", "eppadi", "yen", "enga", "veetla", "veedu", "amma", "appa", "kalyanam", "sollunga",
    "theriyala", "kashtam", "kastam", "bayama", "payama", "thevai", "venum", "vendum", "seiya",
    "kattanum", "katta", "kudukanum", "vanginen", "vaanginen", "vangi", "pochu", "aachu",
}

# Financial keyword → coarse signal (category-level detail lives in debt_categories.json)
FINANCIAL_KEYWORDS = {
    "blade": "blade_finance", "kandhu": "blade_finance", "kanthu": "blade_finance",
    "meter vatti": "blade_finance", "vatti": "high_interest", "வட்டி": "high_interest",
    "interest": "high_interest", "கடன்": "debt", "kadan": "debt", "loan": "debt", "debt": "debt",
    "chit": "chit_fund", "seettu": "chit_fund", "kuri": "chit_fund", "சீட்டு": "chit_fund",
    "gold": "gold_loan", "jewel": "gold_loan", "pawn": "gold_loan", "நகை": "gold_loan",
    "farm": "agricultural_debt", "crop": "agricultural_debt", "விவசாய": "agricultural_debt",
    "wedding": "wedding_debt", "marriage": "wedding_debt", "kalyanam": "wedding_debt",
    "கல்யாணம்": "wedding_debt", "திருமண": "wedding_debt",
    "festival": "festival_credit", "deepavali": "festival_credit", "pongal": "festival_credit",
    "microfinance": "microfinance", "group loan": "microfinance",
    "loan app": "loan_app", "instant loan": "loan_app",
    "hospital": "medical", "surgery": "medical", "மருத்துவ": "medical",
    "fees": "education", "college": "education",
    "credit card": "credit_card", "emi": "emi",
}

URGENCY_KEYWORDS = {
    "crisis": 3, "desperate": 3, "suicide": 5, "dying": 4, "cannot": 2, "can't": 2,
    "helpless": 3, "trapped": 3, "no way out": 4, "மரணம்": 4, "உதவி": 2,
    "unable": 2, "lost": 2, "bankrupt": 3, "seized": 3, "threatening": 4, "threat": 3,
    "harassment": 4, "harass": 3, "தொல்லை": 3, "worry": 2, "worried": 2, "scared": 2,
    "afraid": 2, "urgent": 2, "mudiyala": 2, "mudiyathu": 2, "bayama": 2, "payama": 2,
    "romba kashtam": 3, "kashtam": 2, "pressure": 2, "tension": 2, "panic": 3,
    "auction": 2, "default": 2, "overdue": 2, "notice": 1, "shame": 2, "ashamed": 2,
    "sleep": 1, "crying": 3, "depressed": 3, "hopeless": 4, "கஷ்டம்": 2, "பயம்": 2,
}

_LEADING_NEGATION = re.compile(r"\b(not|no|never|isn't|aren't)\s+(worried|scared|afraid|stressed)\b")


def detect_language(text: str) -> str:
    """'ta' if Tamil script present, 'tanglish' if romanised Tamil, else 'en'."""
    if TAMIL_CHAR.search(text):
        return "ta"
    words = set(re.findall(r"[a-z]+", text.lower()))
    if len(words & TANGLISH_MARKERS) >= 2 or (len(words) <= 6 and words & TANGLISH_MARKERS):
        return "tanglish"
    return "en"


def normalize_text(text: str) -> str:
    """NFC-normalise, lowercase, strip punctuation (keeping Tamil marks), collapse spaces."""
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"[^\w\s஀-௿']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> List[str]:
    return TOKEN_RE.findall(normalize_text(text))


def _contains(phrase: str, normalized: str) -> bool:
    phrase = phrase.lower()
    if TAMIL_CHAR.search(phrase):
        return phrase in normalized              # Tamil words inflect — substring match
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", normalized) is not None


def extract_financial_keywords(text: str) -> List[str]:
    normalized = normalize_text(text)
    return sorted({cat for kw, cat in FINANCIAL_KEYWORDS.items() if _contains(kw, normalized)})


def extract_urgency_score(text: str) -> float:
    """Rule-based urgency score (0–1) from keyword presence."""
    normalized = normalize_text(text)
    total = sum(w for kw, w in URGENCY_KEYWORDS.items() if _contains(kw, normalized))
    if _LEADING_NEGATION.search(normalized):
        total = max(0, total - 3)
    return min(total / 10.0, 1.0)


def preprocess(text: str) -> dict:
    language = detect_language(text)
    normalized = normalize_text(text)
    tokens = TOKEN_RE.findall(normalized)
    return {
        "original": text,
        "normalized": normalized,
        "language": language,
        "tokens": tokens,
        "word_count": len(tokens),
        "financial_keywords": extract_financial_keywords(text),
        "urgency_score": extract_urgency_score(text),
    }
