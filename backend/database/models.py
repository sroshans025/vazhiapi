"""
SQLAlchemy ORM Models — VazhiAPI Database Schema
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, relationship


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    district = Column(String, nullable=True)        # TN district
    preferred_language = Column(String, default="en")
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete")
    feedbacks = relationship("FeedbackEntry", back_populates="user", cascade="all, delete")
    escalations = relationship("EscalationFlag", back_populates="user", cascade="all, delete")


class UserSession(Base):
    """One session = one check-in analysis run through the full 6-layer pipeline."""
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    language = Column(String, default="en")

    # L1 — FFNN Stress Score
    stress_score = Column(Float, nullable=True)
    stress_label = Column(String, nullable=True)     # Low / Moderate / High / Critical

    # L2 — TextCNN Debt Category
    debt_category = Column(String, nullable=True)
    debt_category_probabilities = Column(JSON, nullable=True)

    # L3 — BiLSTM Crisis Trajectory
    crisis_trajectory = Column(String, nullable=True)    # Rising / Stable / Declining
    predicted_peak_score = Column(Float, nullable=True)

    # L4 — Seq2Seq Response
    generated_response = Column(Text, nullable=True)
    attention_weights = Column(JSON, nullable=True)

    # L5 — RL Strategy
    rl_action = Column(String, nullable=True)
    rl_action_probabilities = Column(JSON, nullable=True)

    # L6 — Imitation Refined
    refined_response = Column(Text, nullable=True)

    # Metadata
    request_id = Column(String, unique=True, default=lambda: str(uuid.uuid4()))
    processing_time_ms = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="sessions")
    feedback = relationship("FeedbackEntry", back_populates="session", uselist=False)


class FeedbackEntry(Base):
    """RL reward signal — thumbs up/down from user after each response."""
    __tablename__ = "feedback_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, ForeignKey("user_sessions.id"), nullable=False)
    rating = Column(Integer, nullable=False)          # 1 = thumbs up, -1 = thumbs down
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="feedbacks")
    session = relationship("UserSession", back_populates="feedback")


class EscalationFlag(Base):
    """Human handoff flag — triggered when stress is critical."""
    __tablename__ = "escalation_flags"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    status = Column(String, default="pending")        # pending / in_review / resolved
    assigned_to = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="escalations")
