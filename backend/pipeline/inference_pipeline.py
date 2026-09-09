"""
VazhiAPI — 6-Layer Inference Pipeline
======================================
Chains all DL models sequentially and captures per-layer intermediate outputs
for the model observability panel (/pipeline/debug/{request_id}).

Pipeline order:
  Input text
    → NLP Preprocessing
    → Feature Extraction
    → L1 FFNN: Stress Score
    → L2 TextCNN: Debt Category
    → L3 BiLSTM: Session Trajectory
    → L4 Seq2Seq+Attention: Response Generation
    → L5 PPO/DQN: Strategy Optimization
    → L6 Behaviour Cloning: Tone Refinement
    → Structured Output
"""
from __future__ import annotations
import time
import uuid
from typing import List, Optional

from nlp.preprocessor import preprocess
from nlp.feature_extractor import extract_features, extract_text_sequence
from nlp.crisis_detector import detect_crisis_level, recommend_immediate_action

from models.ffnn_stress import FFNNStressScorer
from models.cnn_classifier import TextCNNClassifier
from models.bilstm_tracker import BiLSTMTracker
from models.seq2seq_generator import Seq2SeqGenerator
from models.drl_optimizer import DRLStrategyOptimizer
from models.imitation_refiner import ImitationRefiner

import numpy as np


class InferencePipeline:
    """
    Singleton pipeline — models loaded once at startup.
    Each call to `run()` executes all 6 layers and returns a rich result dict.
    """

    _instance: Optional["InferencePipeline"] = None

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
            cls._instance = cls()
        return cls._instance

    def load_models(self):
        """Load all 6 model weights (once at startup)."""
        if self._loaded:
            return
        self.ffnn.load()
        self.cnn.load()
        self.bilstm.load()
        self.seq2seq.load()
        self.drl.load()
        self.il.load()
        self._loaded = True

    def run(
        self,
        text: str,
        stress_history: List[float] = None,
        session_count: int = 1,
    ) -> dict:
        """
        Execute the full 6-layer pipeline.

        Returns:
          A complete result dict containing outputs from all 6 layers,
          plus NLP preprocessing metadata, crisis detection, and timing.
        """
        start_time = time.time()
        request_id = str(uuid.uuid4())
        stress_history = stress_history or []

        # ── NLP Preprocessing ────────────────────────────────────────
        preprocessed = preprocess(text)
        features = extract_features(preprocessed)
        token_sequence = extract_text_sequence(preprocessed)
        crisis = detect_crisis_level(text)

        # ── L1: FFNN Stress Scorer ────────────────────────────────────
        l1_output = self.ffnn.predict(features, preprocessed)
        stress_score = l1_output["stress_score"]
        stress_label = l1_output["stress_label"]

        # Crisis override: bump score if crisis phrases detected
        if crisis["level"] == "critical":
            stress_score = max(stress_score, 85)
            stress_label = "Critical"
        elif crisis["level"] == "severe":
            stress_score = max(stress_score, 70)
            stress_label = "High"

        # ── L2: TextCNN Debt Category Classifier ─────────────────────
        l2_output = self.cnn.predict(token_sequence, preprocessed)
        debt_category = l2_output["debt_category"]
        debt_label = l2_output["debt_category_label"]

        # ── L3: BiLSTM Session Context Tracker ───────────────────────
        full_history = stress_history + [stress_score]
        l3_output = self.bilstm.predict(full_history)
        trajectory = l3_output["crisis_trajectory"]
        peak_score = l3_output["predicted_peak_score"]

        # ── L4: Seq2Seq + Bahdanau Attention Response Generator ──────
        l4_output = self.seq2seq.predict(token_sequence, debt_category, stress_label, preprocessed)
        raw_response = l4_output["generated_response"]
        attention_weights = l4_output["attention_weights"]

        # ── L5: PPO/DQN Strategy Optimizer ───────────────────────────
        l5_output = self.drl.predict(stress_score, debt_category, trajectory, session_count)
        rl_action = l5_output["rl_action"]
        rl_label = l5_output["rl_action_label"]
        rl_description = l5_output["rl_action_description"]

        # Override with crisis recommendation if critical
        if crisis["should_escalate"]:
            rl_action = "escalate"
            rl_label = "Connect to Human Counsellor"
            rl_description = "This situation needs immediate human support. A certified counsellor is being notified."

        # ── L6: Behaviour Cloning Tone Refiner ───────────────────────
        l6_output = self.il.refine(raw_response, stress_score, preprocessed)
        refined_response = l6_output["refined_response"]

        processing_ms = round((time.time() - start_time) * 1000, 1)

        return {
            "request_id": request_id,
            "processing_time_ms": processing_ms,

            # NLP
            "language": preprocessed["language"],
            "detected_keywords": preprocessed["financial_keywords"],
            "crisis": crisis,

            # L1
            "stress_score": stress_score,
            "stress_label": stress_label,
            "top_keywords": l1_output["top_keywords"],

            # L2
            "debt_category": debt_category,
            "debt_category_label": debt_label,
            "debt_category_probabilities": l2_output["probabilities"],

            # L3
            "crisis_trajectory": trajectory,
            "predicted_peak_score": peak_score,
            "stress_history": full_history,

            # L4
            "generated_response": raw_response,
            "attention_weights": attention_weights,

            # L5
            "rl_action": rl_action,
            "rl_action_label": rl_label,
            "rl_action_description": rl_description,
            "rl_action_probabilities": l5_output.get("action_probabilities", {}),

            # L6
            "refined_response": refined_response,
            "raw_response_before_refinement": raw_response,

            # Per-layer debug (for observability panel)
            "pipeline_debug": {
                "l1_ffnn": l1_output,
                "l2_textcnn": l2_output,
                "l3_bilstm": l3_output,
                "l4_seq2seq": l4_output,
                "l5_drl": l5_output,
                "l6_imitation": l6_output,
                "nlp_preprocessed": {
                    "language": preprocessed["language"],
                    "word_count": preprocessed["word_count"],
                    "urgency_score": preprocessed["urgency_score"],
                    "financial_keywords": preprocessed["financial_keywords"],
                    "crisis": crisis,
                },
            },
        }


# Module-level accessor
def get_pipeline() -> InferencePipeline:
    return InferencePipeline.get()
