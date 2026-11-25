"""
VazhiAPI — 6-Layer Inference Pipeline
======================================
  Input text → NLP preprocessing → features
    → L1 Stress Scorer → L2 Debt Classifier → L3 Trajectory Tracker
    → L4 Response Generator → L5 Strategy Optimizer → L6 Tone Refiner
    → structured output (+ matched schemes, helplines, per-layer debug)
"""
from __future__ import annotations

import threading
import time
import uuid
from typing import List, Optional

from models.bilstm_tracker import BiLSTMTracker
from models.cnn_classifier import TextCNNClassifier
from models.drl_optimizer import DRLStrategyOptimizer
from models.ffnn_stress import FFNNStressScorer, stress_label as label_for
from models.imitation_refiner import ImitationRefiner
from models.seq2seq_generator import Seq2SeqGenerator
from nlp.crisis_detector import detect_crisis_level
from nlp.feature_extractor import extract_features, extract_text_sequence
from nlp.preprocessor import preprocess
from tn_context import knowledge


class InferencePipeline:
    _instance: Optional["InferencePipeline"] = None
    _lock = threading.Lock()

    def __init__(self):
        self.ffnn = FFNNStressScorer()
        self.cnn = TextCNNClassifier()
        self.bilstm = BiLSTMTracker()
        self.seq2seq = Seq2SeqGenerator()
        self.drl = DRLStrategyOptimizer()
        self.il = ImitationRefiner()
        self._loaded = False

    @classmethod
    def get(cls) -> "InferencePipeline":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def load_models(self):
        if self._loaded:
            return
        for layer in (self.ffnn, self.cnn, self.bilstm, self.seq2seq, self.drl, self.il):
            layer.load()
        self._loaded = True

    def layer_status(self) -> list[dict]:
        return [
            {"layer": "L1", "model": "Stress Scorer (FFNN track)", "unit": "I", "backend": self.ffnn.backend},
            {"layer": "L2", "model": "Debt Classifier (TextCNN track)", "unit": "II", "backend": self.cnn.backend},
            {"layer": "L3", "model": "Trajectory Tracker (BiLSTM track)", "unit": "III-A",
             "backend": "torch-bilstm" if self.bilstm.model is not None else "trend-analysis"},
            {"layer": "L4", "model": "Response Generator (Seq2Seq track)", "unit": "III-B", "backend": self.seq2seq.backend},
            {"layer": "L5", "model": "Strategy Optimizer (PPO track)", "unit": "IV",
             "backend": "sb3-ppo" if self.drl.model is not None else "policy-rules"},
            {"layer": "L6", "model": "Tone Refiner (Behaviour Cloning track)", "unit": "V", "backend": self.il.backend},
        ]

    def run(self, text: str, stress_history: List[float] | None = None, session_count: int = 1) -> dict:
        if not self._loaded:
            self.load_models()
        start = time.perf_counter()
        request_id = str(uuid.uuid4())
        stress_history = list(stress_history or [])

        pre = preprocess(text)
        features = extract_features(pre)
        tokens = extract_text_sequence(pre)
        crisis = detect_crisis_level(text)

        # L1
        l1 = self.ffnn.predict(features, pre)
        stress_score = l1["stress_score"]
        if crisis["level"] == "critical":
            stress_score = max(stress_score, 90.0)
        elif crisis["level"] == "severe":
            stress_score = max(stress_score, 72.0)
        elif crisis["level"] == "high":
            stress_score = max(stress_score, 55.0)
        stress_label = label_for(stress_score)

        # L2
        l2 = self.cnn.predict(tokens, pre)
        debt_category = l2["debt_category"]

        # L3 — stress_history is chronological (oldest → newest)
        full_history = stress_history + [stress_score]
        l3 = self.bilstm.predict(full_history)

        # L4
        l4 = self.seq2seq.predict(tokens, debt_category, stress_label, pre)

        # L5
        l5 = self.drl.predict(stress_score, debt_category, l3["crisis_trajectory"], session_count)
        rl_action, rl_label, rl_desc = l5["rl_action"], l5["rl_action_label"], l5["rl_action_description"]
        if crisis["should_escalate"]:
            rl_action = "escalate"
            rl_label = "Connect to Human Counsellor"
            rl_desc = "This situation needs immediate human support. A counsellor can be notified, and the helplines below are free and confidential."

        # L6
        l6 = self.il.refine(l4["generated_response"], stress_score, pre, crisis["level"])

        cat_info = knowledge.category_map().get(debt_category, {})
        tags = [debt_category] + (["crisis"] if crisis["level"] == "critical" else []) + \
               (["threat"] if crisis["level"] == "severe" else []) + (["stress"] if stress_score >= 50 else [])

        return {
            "request_id": request_id,
            "processing_time_ms": round((time.perf_counter() - start) * 1000, 1),
            "language": pre["language"],
            "detected_keywords": pre["financial_keywords"],
            "crisis": crisis,
            "stress_score": round(stress_score, 1),
            "stress_label": stress_label,
            "top_keywords": l1["top_keywords"],
            "debt_category": debt_category,
            "debt_category_label": l2["debt_category_label"],
            "debt_category_label_ta": cat_info.get("label_ta"),
            "debt_category_icon": cat_info.get("icon"),
            "debt_category_color": cat_info.get("color"),
            "debt_category_probabilities": l2["probabilities"],
            "crisis_trajectory": l3["crisis_trajectory"],
            "predicted_peak_score": l3["predicted_peak_score"],
            "stress_history": full_history,
            "generated_response": l4["generated_response"],
            "attention_weights": l4["attention_weights"],
            "rl_action": rl_action,
            "rl_action_label": rl_label,
            "rl_action_description": rl_desc,
            "rl_action_probabilities": l5.get("action_probabilities", {}),
            "refined_response": l6["refined_response"],
            "raw_response_before_refinement": l4["generated_response"],
            "matched_schemes": [
                {k: s[k] for k in ("id", "name", "name_ta", "benefit", "helpline", "application_url", "type")}
                for s in knowledge.schemes_for(debt_category, limit=3)
            ],
            "helplines": knowledge.helplines_for(tags, limit=3),
            "pipeline_debug": {
                "l1_ffnn": l1, "l2_textcnn": l2, "l3_bilstm": l3,
                "l4_seq2seq": l4, "l5_drl": l5, "l6_imitation": l6,
                "nlp_preprocessed": {
                    "language": pre["language"], "word_count": pre["word_count"],
                    "urgency_score": pre["urgency_score"], "financial_keywords": pre["financial_keywords"],
                    "crisis": crisis,
                },
            },
        }


def get_pipeline() -> InferencePipeline:
    return InferencePipeline.get()
