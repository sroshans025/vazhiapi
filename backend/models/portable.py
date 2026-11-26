"""
Portable (scikit-learn-free) inference for the lite models.

training/train_lite.py fits TF-IDF (char_wb 2-5 + word 1-2) → LogisticRegression / Ridge with
scikit-learn, then exports the fitted vocabularies, IDF weights and coefficients to
models/lite_portable.npz. This module reproduces scikit-learn's exact transform + predict maths
with NumPy only, so the deployed API needs no scikit-learn (smaller serverless bundle, no pickle
version coupling). training/export_portable.py verifies parity against scikit-learn.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

PORTABLE_FILE = Path(__file__).resolve().parent / "lite_portable.npz"
_WHITE_SPACES = re.compile(r"\s\s+")


def _char_wb_ngrams(doc: str, lo: int, hi: int) -> list[str]:
    """Same as sklearn CountVectorizer._char_wb_ngrams."""
    doc = _WHITE_SPACES.sub(" ", doc)
    out: list[str] = []
    for w in doc.split():
        w = " " + w + " "
        w_len = len(w)
        for n in range(lo, hi + 1):
            offset = 0
            out.append(w[offset: offset + n])
            while offset + n < w_len:
                offset += 1
                out.append(w[offset: offset + n])
            if offset == 0:   # short word counted once
                break
    return out


def _word_ngrams(doc: str, pattern: re.Pattern, lo: int, hi: int) -> list[str]:
    """Same as sklearn's word analyzer (no stop words): token_pattern + n-grams joined by a space."""
    tokens = pattern.findall(doc)
    out: list[str] = []
    for n in range(lo, hi + 1):
        if n == 1:
            out.extend(tokens)
        else:
            out.extend(" ".join(tokens[i: i + n]) for i in range(len(tokens) - n + 1))
    return out


class _Tfidf:
    def __init__(self, spec: dict, terms: np.ndarray, idf: np.ndarray, offset: int):
        self.analyzer = spec["analyzer"]
        self.lo, self.hi = spec["ngram_range"]
        self.lowercase = spec["lowercase"]
        self.sublinear = spec["sublinear_tf"]
        self.norm = spec["norm"]
        self.pattern = re.compile(spec["token_pattern"]) if spec.get("token_pattern") else None
        self.vocab = {t: i for i, t in enumerate(terms.tolist())}
        self.idf = idf.astype(np.float64)
        self.offset = offset

    def features(self, text: str) -> dict[int, float]:
        doc = text.lower() if self.lowercase else text
        grams = _char_wb_ngrams(doc, self.lo, self.hi) if self.analyzer == "char_wb" \
            else _word_ngrams(doc, self.pattern, self.lo, self.hi)
        counts: dict[int, int] = {}
        for g in grams:
            j = self.vocab.get(g)
            if j is not None:
                counts[j] = counts.get(j, 0) + 1
        vals = {j: ((1.0 + math.log(c)) if self.sublinear else float(c)) * self.idf[j] for j, c in counts.items()}
        if self.norm == "l2":
            nrm = math.sqrt(sum(v * v for v in vals.values()))
            if nrm > 0:
                vals = {j: v / nrm for j, v in vals.items()}
        return {self.offset + j: v for j, v in vals.items()}


class _Pipeline:
    def __init__(self, data, prefix: str, meta: dict):
        self.parts: list[_Tfidf] = []
        offset = 0
        for k, spec in enumerate(meta[f"{prefix}_vectorizers"]):
            terms, idf = data[f"{prefix}_v{k}_terms"], data[f"{prefix}_v{k}_idf"]
            self.parts.append(_Tfidf(spec, terms, idf, offset))
            offset += len(terms)
        self.coef = data[f"{prefix}_coef"].astype(np.float64)
        self.intercept = data[f"{prefix}_intercept"].astype(np.float64)

    def decision(self, text: str) -> np.ndarray:
        feats: dict[int, float] = {}
        for p in self.parts:
            feats.update(p.features(text))
        if not feats:
            return self.intercept.copy()
        idx = np.fromiter(feats.keys(), dtype=np.int64)
        val = np.fromiter(feats.values(), dtype=np.float64)
        if self.coef.ndim == 1:
            return np.atleast_1d(self.coef[idx] @ val + self.intercept)
        return self.coef[:, idx] @ val + self.intercept


class PortableModels:
    def __init__(self, path: Path = PORTABLE_FILE):
        with np.load(path, allow_pickle=False) as data:
            self.meta = json.loads(str(data["meta"]))
            self.classes = data["clf_classes"].tolist()
            self.clf = _Pipeline(data, "clf", self.meta)
            self.reg = _Pipeline(data, "reg", self.meta)
        self.metrics = self.meta.get("metrics")

    def predict_proba(self, text: str) -> np.ndarray:
        z = self.clf.decision(text)
        z = z - z.max()
        e = np.exp(z)
        return e / e.sum()

    def predict_stress(self, text: str) -> float:
        return float(self.reg.decision(text)[0])


@lru_cache()
def load() -> PortableModels | None:
    return PortableModels() if PORTABLE_FILE.exists() else None
