"""
Layer 4 — Response Generator (Unit III-B)
=========================================
Deep track : GRU encoder–decoder with Bahdanau attention (PyTorch) — architecture below.
Serving    : knowledge-grounded composer — builds a reply from the classified category's
             first steps, the best-matching scheme and the relevant law, in the user's
             language (English / Tamil / Tanglish). v1 answered English users in Tamil.
"""
from __future__ import annotations

import numpy as np

from core.config import get_settings
from tn_context import knowledge

settings = get_settings()

HIDDEN_DIM = 256
VOCAB_SIZE = 8000
EMBED_DIM = 128
MAX_RESPONSE_LEN = 150


def build_seq2seq_model():
    """Return PyTorch Encoder + Decoder + Attention (deep-learning track)."""
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class BahdanauAttention(nn.Module):
        def __init__(self, hidden_dim):
            super().__init__()
            self.Wa = nn.Linear(hidden_dim, hidden_dim)
            self.Ua = nn.Linear(hidden_dim * 2, hidden_dim)
            self.Va = nn.Linear(hidden_dim, 1)

        def forward(self, query, keys):
            scores = self.Va(torch.tanh(self.Wa(query).unsqueeze(1) + self.Ua(keys)))
            weights = F.softmax(scores, dim=1)
            return (weights * keys).sum(dim=1), weights.squeeze(-1)

    class Encoder(nn.Module):
        def __init__(self):
            super().__init__()
            self.embed = nn.Embedding(VOCAB_SIZE, EMBED_DIM, padding_idx=0)
            self.gru = nn.GRU(EMBED_DIM, HIDDEN_DIM, num_layers=2, batch_first=True, dropout=0.3, bidirectional=True)
            self.fc = nn.Linear(HIDDEN_DIM * 2, HIDDEN_DIM)

        def forward(self, x):
            outputs, hidden = self.gru(self.embed(x))
            return outputs, torch.tanh(self.fc(torch.cat([hidden[-2], hidden[-1]], dim=1)))

    class Decoder(nn.Module):
        def __init__(self):
            super().__init__()
            self.embed = nn.Embedding(VOCAB_SIZE, EMBED_DIM, padding_idx=0)
            self.attention = BahdanauAttention(HIDDEN_DIM)
            self.gru = nn.GRU(EMBED_DIM + HIDDEN_DIM * 2, HIDDEN_DIM, batch_first=True)
            self.fc_out = nn.Linear(HIDDEN_DIM, VOCAB_SIZE)

        def forward(self, x, hidden, encoder_outputs):
            embedded = self.embed(x.unsqueeze(1))
            context, attn = self.attention(hidden, encoder_outputs)
            output, hidden = self.gru(torch.cat([embedded, context.unsqueeze(1)], dim=2), hidden.unsqueeze(0))
            return self.fc_out(output.squeeze(1)), hidden.squeeze(0), attn

    return Encoder(), Decoder(), BahdanauAttention(HIDDEN_DIM)


VALIDATION = {
    "en": {
        "high": "That sounds really heavy, and it makes sense that you're scared. This is not a personal failure — {label} traps are designed to be hard to escape.",
        "moderate": "Thank you for telling me. {label} is a common pressure in Tamil Nadu households, and there are concrete ways out.",
        "low": "Good that you're looking at this early — planning now keeps {label} from growing.",
    },
    "ta": {
        "high": "நீங்கள் சொல்வது மிகவும் கனமானது, பயப்படுவது இயல்பு. இது உங்கள் தவறு அல்ல — {label} வேண்டுமென்றே தப்பிக்க கடினமாக வடிவமைக்கப்பட்டது.",
        "moderate": "சொன்னதற்கு நன்றி. {label} தமிழ்நாட்டில் பல குடும்பங்கள் சந்திக்கும் பிரச்சனை — வெளியே வர தெளிவான வழிகள் உள்ளன.",
        "low": "முன்கூட்டியே யோசிப்பது நல்லது — இப்போதே திட்டமிட்டால் {label} பெரிதாகாது.",
    },
    "tanglish": {
        "high": "Neenga sollradhu romba kashtamana vishayam, bayam varadhu normal dhaan. Idhu unga thappu illa — {label} trap ah vechi dhaan design panniruppanga.",
        "moderate": "Sonnadhukku nandri. {label} Tamil Nadu la niraya families ku varra problem dhaan — veliya vara clear ana vazhigal irukku.",
        "low": "Munnadiye yosikkareenga, nalla vishayam — ippove plan panna {label} periyadhaagadhu.",
    },
}

HEADINGS = {
    "en": {"steps": "What you can do now:", "scheme": "Support you may qualify for:", "law": "Your right:"},
    "ta": {"steps": "இப்போது செய்யக்கூடியவை:", "scheme": "உங்களுக்கு உதவக்கூடிய திட்டம்:", "law": "உங்கள் உரிமை:"},
    "tanglish": {"steps": "Ippo pannakoodiyadhu:", "scheme": "Ungalukku help aagura scheme:", "law": "Unga urimai:"},
}


def compose_response(category: str, stress_label: str, lang: str, max_steps: int = 3) -> str:
    lang = lang if lang in VALIDATION else "en"
    cat = knowledge.category_map().get(category) or knowledge.category_map()["general_financial_stress"]
    level = "high" if stress_label in ("Critical", "High") else "moderate" if stress_label == "Moderate" else "low"
    use_ta = lang == "ta"
    label = cat["label_ta"] if use_ta else cat["label"]
    h = HEADINGS[lang]

    parts = [VALIDATION[lang][level].format(label=label)]
    steps = (cat.get("first_steps_ta") if use_ta else None) or cat.get("first_steps", [])
    if steps:
        parts.append(h["steps"] + "\n" + "\n".join(f"{i}. {s}" for i, s in enumerate(steps[:max_steps], 1)))
    schemes = knowledge.schemes_for(category, limit=1)
    if schemes:
        s = schemes[0]
        desc = s.get("description_ta") if use_ta else s.get("benefit")
        parts.append(f"{h['scheme']} **{s['name_ta'] if use_ta else s['name']}** — {desc} (Helpline {s['helpline']})")
    laws = knowledge.laws_for(category)
    if laws and level != "low":
        law = laws[0]
        parts.append(f"{h['law']} {law['summary_ta'] if use_ta else law['summary']}")
    return "\n\n".join(parts)


class Seq2SeqGenerator:
    def __init__(self):
        self.encoder = None
        self.decoder = None
        self.backend = "kb-composer"

    def load(self, weights_path: str = None):
        return  # PyTorch decoder is training-track only; serving uses the KB composer.

    def predict(self, token_sequence: list, debt_category: str, stress_label: str, preprocessed: dict) -> dict:
        lang = preprocessed.get("language", "en")
        response_text = compose_response(debt_category, stress_label, lang)

        # Attention-style saliency over input tokens: financial / urgency words weigh more.
        tokens = preprocessed.get("tokens", [])[:24] or ["input"]
        kw = " ".join(preprocessed.get("financial_keywords", []))
        raw = np.array([
            1.0 + (2.5 if any(t in k or k.startswith(t[:4]) for k in kw.split()) else 0.0)
            + (1.5 if len(t) > 5 else 0.0)
            for t in tokens
        ])
        weights = raw / raw.sum()
        return {
            "generated_response": response_text,
            "attention_weights": {t: round(float(w), 4) for t, w in zip(tokens, weights)},
            "language": lang,
            "model": f"Response Generator — {self.backend} (Unit III-B)",
        }
