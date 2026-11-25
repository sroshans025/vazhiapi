"""
Crisis Detector — VazhiAPI
Rule-based severity flags that augment the L1 stress score. Safety-critical:
these rules run on every message regardless of which model or chat engine is used.

v2: whole-word matching (v1 flagged "physical exam" or "no pointless" as crises),
plus Tanglish and more Tamil phrasings.
"""
import re

from nlp.preprocessor import TAMIL_CHAR, normalize_text

CRISIS_PHRASES = [
    "suicide", "suicidal", "kill myself", "end my life", "end it all", "take my life",
    "don't want to live", "dont want to live", "do not want to live", "want to die",
    "better off dead", "no reason to live", "can't live anymore", "cant live anymore",
    "consume poison", "drink poison", "hang myself", "jump from", "self harm", "hurt myself",
    "sethuruven", "seththuruven", "saaganum", "sethu poganum", "uyir vida", "thookku",
    "தற்கொலை", "சாகணும்", "சாக வேண்டும்", "உயிரை மாய்த்து", "இறந்துவிடுவேன்", "சாவதைத் தவிர", "விஷம் குடி",
]

SEVERE_PHRASES = [
    "threatening", "threatened", "threaten", "harassment", "harassing", "harass",
    "beaten", "beat me", "hit me", "attacked", "violence", "abusing", "abused",
    "morphed", "nude photo", "obscene", "blackmail", "extortion",
    "seized my property", "took my land", "took my house", "locked my house", "kidnap",
    "calling my relatives", "calling my contacts", "messaging my contacts",
    "mirattal", "miratturanga", "adikiranga", "adichaanga",
    "மிரட்டல்", "மிரட்டுகிறார்கள்", "அடித்தார்கள்", "கொடுமை", "துன்புறுத்துகிறார்கள்", "சொத்து பறிக்கப்பட்டது",
]

HIGH_PHRASES = [
    "cannot repay", "can't repay", "cant repay", "unable to repay", "defaulted", "no money",
    "bankrupt", "lost everything", "all gone", "auction notice", "legal notice",
    "can't pay", "cannot pay", "no food", "kids hungry", "can't sleep", "cannot sleep",
    "kadan kattala mudiyathu", "kadan katta mudiyala", "katta mudiyala", "panam illa", "kaasu illa",
    "கடன் கட்ட முடியாது", "கடன் கட்டல முடியாது", "பணமில்லை", "பணம் இல்லை", "எல்லாமே போச்சு",
]

_NEGATED = re.compile(r"\b(not|never|no longer|don't|do not)\s+(thinking of|planning to|going to)\s+(suicide|kill)")


def _hit(phrase: str, normalized: str) -> bool:
    p = normalize_text(phrase)
    if TAMIL_CHAR.search(p):
        return p in normalized
    return re.search(rf"(?<![a-z0-9]){re.escape(p)}(?![a-z0-9])", normalized) is not None


def detect_crisis_level(text: str) -> dict:
    """
    Returns severity level and triggered flags.
    Severity: 'critical' | 'severe' | 'high' | 'low'
    """
    normalized = normalize_text(text)
    triggered = []
    for severity, phrases in (("critical", CRISIS_PHRASES), ("severe", SEVERE_PHRASES), ("high", HIGH_PHRASES)):
        for phrase in phrases:
            if _hit(phrase, normalized):
                triggered.append({"phrase": phrase, "severity": severity})

    # "I'm not thinking of suicide" — keep it flagged as high (worth a check-in), not critical.
    if _NEGATED.search(normalized):
        triggered = [dict(t, severity="high") if t["severity"] == "critical" else t for t in triggered]

    levels = [t["severity"] for t in triggered]
    level = next((l for l in ("critical", "severe", "high") if l in levels), "low")
    return {
        "level": level,
        "should_escalate": level in ("critical", "severe"),
        "self_harm_risk": level == "critical",
        "triggered_flags": triggered,
    }


def recommend_immediate_action(crisis_level: str, stress_score: float) -> str:
    """Map crisis + stress to a concrete recommended action."""
    if crisis_level == "critical":
        return "escalate"
    if crisis_level == "severe" or stress_score >= 75:
        return "legal_rights"
    if crisis_level == "high" or stress_score >= 50:
        return "shg_alternative"
    return "validate"
