"""
Lite models (L1 stress regressor, L2 category classifier) — loader.

Order of preference:
  1. models/lite_portable.npz — NumPy-only export, committed to the repo. Used in production
     (Vercel / Docker) so the API needs neither scikit-learn nor a writable filesystem.
  2. scikit-learn bundle in MODEL_WEIGHTS_DIR (development), trained on first use if missing.
  3. None → the layers fall back to their rule-based heuristics.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

from core.config import get_settings

log = logging.getLogger("vazhi")
_lock = threading.Lock()
_state: dict | None = None
_failed = False


def _load_sklearn() -> dict:
    import joblib
    from training.train_lite import WEIGHTS_FILE, train

    path = Path(get_settings().MODEL_WEIGHTS_DIR) / WEIGHTS_FILE
    if not path.exists():
        log.info("lite models missing — training now")
        train(verbose=False)
    b = joblib.load(path)
    clf, reg, classes = b["classifier"], b["stress"], b["classes"]
    return {
        "backend": "sklearn",
        "metrics": b.get("metrics"),
        "proba": lambda t: dict(zip(classes, (float(p) for p in clf.predict_proba([t])[0]))),
        "stress": lambda t: float(reg.predict([t])[0]),
    }


def _load_portable() -> dict | None:
    from models import portable

    pm = portable.load()
    if pm is None:
        return None
    return {
        "backend": "portable",
        "metrics": pm.metrics,
        "proba": lambda t: dict(zip(pm.classes, (float(p) for p in pm.predict_proba(t)))),
        "stress": pm.predict_stress,
    }


def get_bundle() -> dict | None:
    global _state, _failed
    if _state is not None or _failed:
        return _state
    with _lock:
        if _state is not None or _failed:
            return _state
        for loader in (_load_portable, _load_sklearn):
            try:
                _state = loader()
            except Exception as exc:
                log.warning("lite model loader %s failed: %s", loader.__name__, exc)
                _state = None
            if _state:
                log.info("lite models loaded (%s): %s", _state["backend"], _state.get("metrics"))
                break
        if _state is None:
            log.warning("lite models unavailable; using heuristic fallbacks")
            _failed = True
    return _state


def predict_stress(text: str) -> float | None:
    b = get_bundle()
    return b["stress"](text) if b else None


def predict_category_proba(text: str) -> dict[str, float] | None:
    b = get_bundle()
    return b["proba"](text) if b else None
