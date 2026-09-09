"""
Crisis Detector — VazhiAPI
Rule-based severity flags that augment L1 FFNN stress score.
"""
from typing import List

CRISIS_PHRASES = [
    "suicide", "kill myself", "end my life", "மரணம்", "இறந்துவிடுவேன்",
    "can't live", "no point", "no reason to live", "உயிரை மாய்த்துக்கொள்",
]

SEVERE_PHRASES = [
    "threatening", "harassment", "threatened", "violence", "physical", "beaten",
    "seized my property", "took my land", "கொடுமை", "துன்புறுத்துகிறார்கள்",
    "சொத்து பறிக்கப்பட்டது",
]

HIGH_PHRASES = [
    "cannot repay", "defaulted", "no money", "bankrupt", "lost everything",
    "all gone", "kadan kattala mudiyathu", "கடன் கட்டல முடியாது",
    "பணமில்லை", "எல்லாமே போச்சு",
]


def detect_crisis_level(text: str) -> dict:
    """
    Returns severity level and triggered flags.
    Severity: 'critical' | 'severe' | 'high' | 'moderate' | 'low'
    """
    lower = text.lower()
    triggered = []

    for phrase in CRISIS_PHRASES:
        if phrase.lower() in lower:
            triggered.append({"phrase": phrase, "severity": "critical"})

    for phrase in SEVERE_PHRASES:
        if phrase.lower() in lower:
            triggered.append({"phrase": phrase, "severity": "severe"})

    for phrase in HIGH_PHRASES:
        if phrase.lower() in lower:
            triggered.append({"phrase": phrase, "severity": "high"})

    if any(t["severity"] == "critical" for t in triggered):
        level = "critical"
    elif any(t["severity"] == "severe" for t in triggered):
        level = "severe"
    elif any(t["severity"] == "high" for t in triggered):
        level = "high"
    elif triggered:
        level = "moderate"
    else:
        level = "low"

    return {
        "level": level,
        "should_escalate": level in ("critical", "severe"),
        "triggered_flags": triggered,
    }


def recommend_immediate_action(crisis_level: str, stress_score: float) -> str:
    """Map crisis + stress to a concrete recommended action."""
    if crisis_level == "critical":
        return "escalate"
    elif crisis_level == "severe" or stress_score >= 75:
        return "legal_rights"
    elif crisis_level == "high" or stress_score >= 50:
        return "shg_alternative"
    else:
        return "validate"
