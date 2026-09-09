"""
Layer 3 — BiLSTM Session Context Tracker (Unit III-A)
======================================================
Architecture: Bidirectional LSTM
Input:  Sequence of stress scores from previous sessions (context window)
Output: Crisis trajectory label + predicted peak score

Hidden size: 256 (128 per direction)
Layers: 2 stacked BiLSTM
Output: regression (peak score) + classification (trajectory)

Framework: PyTorch

Training: See backend/training/train_bilstm.py
Dataset:  EmpatheticDialogues (Facebook AI) adapted for stress trajectory
"""
from __future__ import annotations
from typing import List
import numpy as np
from core.config import get_settings

settings = get_settings()

HIDDEN_SIZE = 128
NUM_LAYERS = 2
INPUT_SIZE = 1     # single stress score per timestep
MAX_CONTEXT = 10   # look back up to 10 sessions


def build_bilstm_model():
    """Return a PyTorch BiLSTM module (import pytorch at call time)."""
    import torch
    import torch.nn as nn

    class BiLSTMTracker(nn.Module):
        def __init__(self):
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=INPUT_SIZE,
                hidden_size=HIDDEN_SIZE,
                num_layers=NUM_LAYERS,
                batch_first=True,
                bidirectional=True,
                dropout=0.3,
            )
            # Heads
            self.trajectory_head = nn.Linear(HIDDEN_SIZE * 2, 3)  # Rising/Stable/Declining
            self.peak_head = nn.Linear(HIDDEN_SIZE * 2, 1)         # predicted peak 0–100

        def forward(self, x):
            # x: (batch, seq_len, 1)
            out, (h, c) = self.lstm(x)
            last_hidden = out[:, -1, :]  # take last timestep
            trajectory_logits = self.trajectory_head(last_hidden)
            peak_score = self.peak_head(last_hidden).squeeze(-1) * 100
            return trajectory_logits, peak_score

    return BiLSTMTracker()


TRAJECTORY_LABELS = ["Rising", "Stable", "Declining"]


class BiLSTMTracker:
    """
    L3 — Session Crisis Trajectory Tracker.
    Accepts a list of historical stress scores, predicts trajectory and peak.
    """

    def __init__(self):
        self.model = None
        self._mock = settings.USE_MOCK_MODELS

    def load(self, weights_path: str = None):
        if self._mock:
            return
        import torch
        self.model = build_bilstm_model()
        if weights_path:
            self.model.load_state_dict(torch.load(weights_path, map_location="cpu"))
        self.model.eval()

    def predict(self, stress_history: List[float]) -> dict:
        if self._mock:
            return self._mock_predict(stress_history)

        import torch
        if len(stress_history) < 2:
            return self._mock_predict(stress_history)

        seq = stress_history[-MAX_CONTEXT:]
        x = torch.tensor([[s / 100.0] for s in seq], dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            traj_logits, peak = self.model(x)
            traj_idx = int(traj_logits.argmax(-1).item())
            peak_val = float(peak.item())
        return self._format_output(TRAJECTORY_LABELS[traj_idx], peak_val, stress_history)

    def _mock_predict(self, history: List[float]) -> dict:
        """Simple trend analysis mock."""
        if len(history) < 2:
            return self._format_output("Stable", history[-1] if history else 50.0, history)

        recent = history[-5:]
        trend = recent[-1] - recent[0] if len(recent) >= 2 else 0

        if trend > 10:
            trajectory = "Rising"
            peak = min(recent[-1] + trend * 2, 95)
        elif trend < -10:
            trajectory = "Declining"
            peak = max(recent[-1], 20)
        else:
            trajectory = "Stable"
            peak = recent[-1]

        return self._format_output(trajectory, peak, history)

    def _format_output(self, trajectory: str, peak: float, history: List[float]) -> dict:
        return {
            "crisis_trajectory": trajectory,
            "predicted_peak_score": round(peak, 1),
            "session_count": len(history),
            "stress_history": [round(s, 1) for s in history],
            "model": "BiLSTM (Unit III-A)",
        }
