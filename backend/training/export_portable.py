"""
Export the scikit-learn lite models to models/lite_portable.npz (NumPy only, no pickle) and
verify the portable implementation reproduces scikit-learn exactly on the whole corpus.

Run:  python -m training.export_portable      (train_lite runs this automatically)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.portable import PORTABLE_FILE, PortableModels  # noqa: E402


def _vectorizers(pipeline):
    union = pipeline.steps[0][1]
    return [v for _, v in union.transformer_list]


def _spec(v) -> dict:
    return {"analyzer": v.analyzer, "ngram_range": list(v.ngram_range), "lowercase": v.lowercase,
            "sublinear_tf": v.sublinear_tf, "norm": v.norm,
            "token_pattern": v.token_pattern if v.analyzer == "word" else None}


def export(bundle: dict, verify_texts: list[str] | None = None, verbose: bool = True) -> Path:
    arrays: dict[str, np.ndarray] = {}
    meta: dict = {"metrics": bundle.get("metrics"), "format": 1}
    for prefix, pipe in (("clf", bundle["classifier"]), ("reg", bundle["stress"])):
        vecs = _vectorizers(pipe)
        meta[f"{prefix}_vectorizers"] = [_spec(v) for v in vecs]
        for k, v in enumerate(vecs):
            terms = sorted(v.vocabulary_, key=v.vocabulary_.get)
            arrays[f"{prefix}_v{k}_terms"] = np.array(terms, dtype=str)
            arrays[f"{prefix}_v{k}_idf"] = v.idf_.astype(np.float32)
        est = pipe.steps[-1][1]
        arrays[f"{prefix}_coef"] = np.asarray(est.coef_, dtype=np.float32)
        arrays[f"{prefix}_intercept"] = np.atleast_1d(np.asarray(est.intercept_, dtype=np.float64))
    arrays["clf_classes"] = np.array(list(bundle["classifier"].classes_), dtype=str)
    arrays["meta"] = np.array(json.dumps(meta))
    np.savez_compressed(PORTABLE_FILE, **arrays)

    if verify_texts:
        pm = PortableModels(PORTABLE_FILE)
        sk_p = bundle["classifier"].predict_proba(verify_texts)
        sk_s = bundle["stress"].predict(verify_texts)
        pt_p = np.array([pm.predict_proba(t) for t in verify_texts])
        pt_s = np.array([pm.predict_stress(t) for t in verify_texts])
        dp, ds = float(np.abs(sk_p - pt_p).max()), float(np.abs(sk_s - pt_s).max())
        agree = float((sk_p.argmax(1) == pt_p.argmax(1)).mean())
        if verbose:
            print(f"parity on {len(verify_texts)} texts: max |Δprob| = {dp:.2e}, max |Δstress| = {ds:.2e}, top-class agreement = {agree:.2%}")
        assert dp < 1e-4 and ds < 1e-2 and agree == 1.0, "portable model does not match scikit-learn"
    if verbose:
        print(f"wrote {PORTABLE_FILE} ({PORTABLE_FILE.stat().st_size // 1024} KB)")
    return PORTABLE_FILE


if __name__ == "__main__":
    import joblib

    from core.config import get_settings
    from training.corpus import load
    from training.train_lite import WEIGHTS_FILE

    bundle = joblib.load(Path(get_settings().MODEL_WEIGHTS_DIR) / WEIGHTS_FILE)
    texts = [r["text"] for r in load()]
    texts += ["", "hi", "நகை", "  spaces   everywhere  ", "kandhu vatti 10% per week!!"]
    export(bundle, texts)
