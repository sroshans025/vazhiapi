"""
Loader for the scikit-learn "lite" models (L1 stress regressor, L2 category classifier).
Trains them on first use if the weights file is missing (≈1 s), so fresh deploys work
without committing binary artefacts.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

from core.config import get_settings

log = logging.getLogger("vazhi")
_lock = threading.Lock()
_bundle: dict | None = None
_failed = False


def get_bundle() -> dict | None:
    global _bundle, _failed
    if _bundle is not None or _failed:
        return _bundle
    with _lock:
        if _bundle is not None or _failed:
            return _bundle
        try:
            import joblib
            from training.train_lite import WEIGHTS_FILE, train

            path = Path(get_settings().MODEL_WEIGHTS_DIR) / WEIGHTS_FILE
            if not path.exists():
                log.info("lite models missing — training now")
                train(verbose=False)
            _bundle = joblib.load(path)
            log.info("lite models loaded: %s", _bundle.get("metrics"))
        except Exception as exc:  # scikit-learn missing or corrupt file → heuristics
            log.warning("lite models unavailable (%s); using heuristic fallbacks", exc)
            _failed = True
    return _bundle


def predict_stress(text: str) -> float | None:
    b = get_bundle()
    if not b:
        return None
    return float(b["stress"].predict([text])[0])


def predict_category_proba(text: str) -> dict[str, float] | None:
    b = get_bundle()
    if not b:
        return None
    probs = b["classifier"].predict_proba([text])[0]
    return {c: float(p) for c, p in zip(b["classes"], probs)}
