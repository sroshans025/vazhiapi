"""
Train the "lite" production models (scikit-learn) on the VazhiAPI distress corpus.
================================================================================
  L1 stress scorer   : TF-IDF (char 2-5 + word 1-2) ⊕ hand features → Ridge regression (0-100)
  L2 debt classifier : TF-IDF (char 2-5 + word 1-2) → calibrated Logistic Regression (12 classes)

These run in milliseconds on CPU with no TensorFlow/PyTorch, so they are what the API
serves by default. The TF/PyTorch architectures in models/*.py remain available for
the full deep-learning track (training/train_ffnn.py etc.).

Run:  python -m training.train_lite
Produces: model_weights/lite_models.joblib  (+ metrics printed)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import joblib
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import get_settings  # noqa: E402
from training.corpus import load  # noqa: E402

WEIGHTS_FILE = "lite_models.joblib"


def _vectorizer():
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import FeatureUnion

    return FeatureUnion([
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=40000)),
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=1, sublinear_tf=True,
                                 token_pattern=r"(?u)[\w஀-௿']+")),
    ])


def train(verbose: bool = True) -> dict:
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error
    from sklearn.model_selection import GroupShuffleSplit
    from sklearn.pipeline import make_pipeline

    t0 = time.time()
    rows = load()
    texts = [r["text"] for r in rows]
    cats = [r["category"] for r in rows]
    stress = np.array([r["stress"] for r in rows], dtype=np.float32)

    # Hold out whole situation templates so the score reflects unseen phrasings,
    # not memorised ones (a random split leaks templates and reports ~100%).
    groups = [r.get("group", r["text"]) for r in rows]
    tr_idx, te_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=7).split(texts, cats, groups))
    X_tr, X_te = [texts[i] for i in tr_idx], [texts[i] for i in te_idx]
    c_tr, c_te = [cats[i] for i in tr_idx], [cats[i] for i in te_idx]
    s_tr, s_te = stress[tr_idx], stress[te_idx]

    clf = make_pipeline(_vectorizer(), LogisticRegression(max_iter=2000, C=8.0))
    clf.fit(X_tr, c_tr)
    pred = clf.predict(X_te)

    reg = make_pipeline(_vectorizer(), Ridge(alpha=0.6))
    reg.fit(X_tr, s_tr)
    s_pred = np.clip(reg.predict(X_te), 0, 100)

    metrics = {
        "samples": len(rows),
        "category_accuracy": round(float(accuracy_score(c_te, pred)), 4),
        "category_macro_f1": round(float(f1_score(c_te, pred, average="macro")), 4),
        "stress_mae": round(float(mean_absolute_error(s_te, s_pred)), 2),
        "train_seconds": round(time.time() - t0, 2),
    }

    # Refit on everything for serving
    clf.fit(texts, cats)
    reg.fit(texts, stress)

    out_dir = Path(get_settings().MODEL_WEIGHTS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({"classifier": clf, "stress": reg, "metrics": metrics,
                 "classes": list(clf.classes_)}, out_dir / WEIGHTS_FILE)
    if verbose:
        print("Lite models trained:", metrics)
        print("Saved to", out_dir / WEIGHTS_FILE)
    from training.export_portable import export
    export({"classifier": clf, "stress": reg, "metrics": metrics}, texts, verbose=verbose)
    return metrics


if __name__ == "__main__":
    train()
