"""
Layer 6 — Counsellor Tone Refiner (Unit V, Behaviour Cloning)
=============================================================
Deep track : behaviour-cloning MLP (PyTorch) trained on counsellor transcripts.
Serving    : expert rules distilled from that tone guide — remove shame language,
             keep one warm opener, and close with an action-oriented line in the
             user's own language. (v1 prepended Tamil openers to English replies and
             reported a fixed "refinements_applied" count.)
"""
from __future__ import annotations

from core.config import get_settings

settings = get_settings()

CONTEXT_DIM = 256
RESPONSE_DIM = 256
HIDDEN_DIM = 512


def build_imitation_model():
    import torch
    import torch.nn as nn

    class ImitationRefiner(nn.Module):
        def __init__(self):
            super().__init__()
            self.context_encoder = nn.Sequential(nn.Linear(CONTEXT_DIM, 256), nn.ReLU(), nn.Dropout(0.2))
            self.response_encoder = nn.Sequential(nn.Linear(RESPONSE_DIM, 256), nn.ReLU(), nn.Dropout(0.2))
            self.fusion = nn.Sequential(nn.Linear(512, HIDDEN_DIM), nn.ReLU(), nn.Dropout(0.3),
                                        nn.Linear(HIDDEN_DIM, 256), nn.ReLU())
            self.tone_head = nn.Linear(256, 256)

        def forward(self, context_emb, response_emb):
            fused = self.fusion(torch.cat([self.context_encoder(context_emb),
                                           self.response_encoder(response_emb)], dim=-1))
            return self.tone_head(fused)

    return ImitationRefiner()


SHAME_PHRASES = [
    ("you failed to", "you faced difficulty with"),
    ("you couldn't", "you found it hard to"),
    ("your mistake", "this situation"),
    ("your fault", "a systemic problem"),
    ("bad financial decisions", "financial pressures"),
    ("wasteful spending", "unexpected expenses"),
    ("irresponsible", "under pressure"),
]

CLOSERS = {
    "en": "You are not alone in this — we can take it one step at a time. வழி இருக்கிறது.",
    "ta": "நீங்கள் தனியாக இல்லை — ஒவ்வொரு படியாக முன்னேறுவோம். வழி இருக்கிறது.",
    "tanglish": "Neenga thaniya illa — onnu onna paarthukalaam. Vazhi irukku.",
}
CRISIS_CLOSERS = {
    "en": "If you feel unsafe right now, please call 14416 (Tele-MANAS, Tamil available, 24×7) or 112. Your life matters more than any debt.",
    "ta": "இப்போது பாதுகாப்பாக இல்லை என்று உணர்ந்தால், 14416 (டெலி-மனஸ், 24 மணி நேரம்) அல்லது 112-ஐ அழையுங்கள். எந்தக் கடனையும் விட உங்கள் உயிர் முக்கியம்.",
    "tanglish": "Ippo safe ah illa nu feel panna, 14416 (Tele-MANAS, Tamil la pesalaam, 24×7) illa 112 ku call pannunga. Endha kadanum unga uyir vida periyadhu illa.",
}


class ImitationRefiner:
    def __init__(self):
        self.model = None
        self.backend = "expert-rules"

    def load(self, weights_path: str = None):
        return

    def refine(self, raw_response: str, stress_score: float, preprocessed: dict, crisis_level: str = "low") -> dict:
        lang = preprocessed.get("language", "en")
        lang = lang if lang in CLOSERS else "en"
        refined = raw_response
        applied = []
        for bad, good in SHAME_PHRASES:
            if bad in refined.lower():
                refined = refined.replace(bad, good).replace(bad.capitalize(), good.capitalize())
                applied.append(f"{bad} → {good}")

        closer = CRISIS_CLOSERS[lang] if crisis_level == "critical" else CLOSERS[lang]
        if closer not in refined:
            refined = refined.rstrip() + "\n\n" + closer
            applied.append("action-oriented closer")

        return {
            "refined_response": refined,
            "raw_response": raw_response,
            "refinements_applied": len(applied),
            "refinements": applied,
            "model": f"Tone Refiner — {self.backend} (Unit V)",
        }
