"""
CRUD Operations — VazhiAPI Database Layer
"""
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from database.models import User, UserSession, FeedbackEntry, EscalationFlag
from core.security import hash_password


# ── User Operations ──────────────────────────────────────────────

async def create_user(db: AsyncSession, email: str, password: str, full_name: str = None, district: str = None) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        district=district,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# ── Session Operations ────────────────────────────────────────────

async def create_session(db: AsyncSession, **kwargs) -> UserSession:
    session = UserSession(**kwargs)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_user_sessions(db: AsyncSession, user_id: str, limit: int = 50) -> List[UserSession]:
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .order_by(desc(UserSession.created_at))
        .limit(limit)
    )
    return result.scalars().all()


async def get_session_by_request_id(db: AsyncSession, request_id: str) -> Optional[UserSession]:
    result = await db.execute(
        select(UserSession).where(UserSession.request_id == request_id)
    )
    return result.scalar_one_or_none()


async def get_latest_session(db: AsyncSession, user_id: str) -> Optional[UserSession]:
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .order_by(desc(UserSession.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


# ── Feedback Operations ───────────────────────────────────────────

async def create_feedback(db: AsyncSession, user_id: str, session_id: str, rating: int, comment: str = None) -> FeedbackEntry:
    fb = FeedbackEntry(user_id=user_id, session_id=session_id, rating=rating, comment=comment)
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return fb


# ── Escalation Operations ─────────────────────────────────────────

async def create_escalation(db: AsyncSession, user_id: str, session_id: str = None, reason: str = None) -> EscalationFlag:
    esc = EscalationFlag(user_id=user_id, session_id=session_id, reason=reason)
    db.add(esc)
    await db.commit()
    await db.refresh(esc)
    return esc


async def get_pending_escalations(db: AsyncSession, limit: int = 100) -> List[EscalationFlag]:
    result = await db.execute(
        select(EscalationFlag)
        .where(EscalationFlag.status == "pending")
        .order_by(desc(EscalationFlag.created_at))
        .limit(limit)
    )
    return result.scalars().all()


# ── Admin Analytics ───────────────────────────────────────────────

async def get_aggregate_stats(db: AsyncSession) -> dict:
    total_users = await db.scalar(select(func.count(User.id)))
    total_sessions = await db.scalar(select(func.count(UserSession.id)))
    avg_stress = await db.scalar(select(func.avg(UserSession.stress_score)))
    pending_escalations = await db.scalar(
        select(func.count(EscalationFlag.id)).where(EscalationFlag.status == "pending")
    )
    return {
        "total_users": total_users or 0,
        "total_sessions": total_sessions or 0,
        "avg_stress_score": round(avg_stress or 0, 1),
        "pending_escalations": pending_escalations or 0,
    }
