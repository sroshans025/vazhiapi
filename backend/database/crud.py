"""
CRUD Operations — VazhiAPI Database Layer
"""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password
from database.models import (
    ChatConversation, ChatMessage, EscalationFlag, FeedbackEntry, User, UserSession,
)


def iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialise datetimes as explicit UTC (SQLite drops tzinfo, which made JS parse local time)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ── User Operations ──────────────────────────────────────────────

async def create_user(db: AsyncSession, email: str, password: str, full_name: str = None,
                      district: str = None, preferred_language: str = "en",
                      is_admin: bool = False) -> User:
    user = User(
        email=email.strip().lower(),
        hashed_password=hash_password(password),
        full_name=full_name,
        district=district,
        preferred_language=preferred_language,
        is_admin=is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(func.lower(User.email) == email.strip().lower()))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def delete_user(db: AsyncSession, user: User) -> None:
    """Hard-delete a user and everything they created (right to be forgotten)."""
    conv_ids = (await db.execute(
        select(ChatConversation.id).where(ChatConversation.user_id == user.id)
    )).scalars().all()
    if conv_ids:
        await db.execute(delete(ChatMessage).where(ChatMessage.conversation_id.in_(conv_ids)))
    await db.execute(delete(ChatConversation).where(ChatConversation.user_id == user.id))
    await db.execute(delete(FeedbackEntry).where(FeedbackEntry.user_id == user.id))
    await db.execute(delete(EscalationFlag).where(EscalationFlag.user_id == user.id))
    await db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()


# ── Session (analysis) Operations ─────────────────────────────────

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
    return list(result.scalars().all())


async def get_session_by_id(db: AsyncSession, session_id: str) -> Optional[UserSession]:
    result = await db.execute(select(UserSession).where(UserSession.id == session_id))
    return result.scalar_one_or_none()


async def get_session_by_request_id(db: AsyncSession, request_id: str) -> Optional[UserSession]:
    result = await db.execute(select(UserSession).where(UserSession.request_id == request_id))
    return result.scalar_one_or_none()


async def get_latest_session(db: AsyncSession, user_id: str) -> Optional[UserSession]:
    sessions = await get_user_sessions(db, user_id, limit=1)
    return sessions[0] if sessions else None


# ── Feedback Operations ───────────────────────────────────────────

async def get_feedback_for_session(db: AsyncSession, session_id: str) -> Optional[FeedbackEntry]:
    result = await db.execute(select(FeedbackEntry).where(FeedbackEntry.session_id == session_id))
    return result.scalar_one_or_none()


async def upsert_feedback(db: AsyncSession, user_id: str, session_id: str, rating: int,
                          comment: str = None, message_id: str = None) -> FeedbackEntry:
    """One feedback per analysis session — re-rating updates the existing entry."""
    fb = await get_feedback_for_session(db, session_id)
    if fb is None:
        fb = FeedbackEntry(user_id=user_id, session_id=session_id)
        db.add(fb)
    fb.rating = rating
    fb.comment = comment
    fb.message_id = message_id
    await db.commit()
    await db.refresh(fb)
    return fb


# ── Escalation Operations ─────────────────────────────────────────

async def create_escalation(db: AsyncSession, user_id: str, session_id: str = None,
                            reason: str = None) -> EscalationFlag:
    esc = EscalationFlag(user_id=user_id, session_id=session_id, reason=reason)
    db.add(esc)
    await db.commit()
    await db.refresh(esc)
    return esc


async def get_open_escalation(db: AsyncSession, user_id: str) -> Optional[EscalationFlag]:
    result = await db.execute(
        select(EscalationFlag)
        .where(EscalationFlag.user_id == user_id, EscalationFlag.status != "resolved")
        .order_by(desc(EscalationFlag.created_at)).limit(1)
    )
    return result.scalar_one_or_none()


async def get_escalations(db: AsyncSession, status: Optional[str] = None,
                          limit: int = 100) -> List[EscalationFlag]:
    q = select(EscalationFlag).order_by(desc(EscalationFlag.created_at)).limit(limit)
    if status:
        q = q.where(EscalationFlag.status == status)
    return list((await db.execute(q)).scalars().all())


async def get_pending_escalations(db: AsyncSession, limit: int = 100) -> List[EscalationFlag]:
    return await get_escalations(db, "pending", limit)


async def get_escalation(db: AsyncSession, escalation_id: str) -> Optional[EscalationFlag]:
    result = await db.execute(select(EscalationFlag).where(EscalationFlag.id == escalation_id))
    return result.scalar_one_or_none()


# ── Chat Operations ───────────────────────────────────────────────

async def create_conversation(db: AsyncSession, user_id: str, title: str = None,
                              language: str = "en") -> ChatConversation:
    conv = ChatConversation(user_id=user_id, title=title, language=language)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def get_conversation(db: AsyncSession, conversation_id: str) -> Optional[ChatConversation]:
    result = await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id))
    return result.scalar_one_or_none()


async def list_conversations(db: AsyncSession, user_id: str, limit: int = 50) -> List[dict]:
    count_sq = (
        select(ChatMessage.conversation_id, func.count(ChatMessage.id).label("n"))
        .group_by(ChatMessage.conversation_id).subquery()
    )
    result = await db.execute(
        select(ChatConversation, count_sq.c.n)
        .outerjoin(count_sq, count_sq.c.conversation_id == ChatConversation.id)
        .where(ChatConversation.user_id == user_id)
        .order_by(desc(ChatConversation.updated_at))
        .limit(limit)
    )
    return [{"conversation": c, "message_count": n or 0} for c, n in result.all()]


async def get_messages(db: AsyncSession, conversation_id: str, limit: int = 200) -> List[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def add_message(db: AsyncSession, conversation: ChatConversation, role: str, content: str,
                      session_id: str = None, meta: dict = None) -> ChatMessage:
    msg = ChatMessage(conversation_id=conversation.id, role=role, content=content,
                      session_id=session_id, meta=meta)
    db.add(msg)
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    return msg


async def delete_conversation(db: AsyncSession, conversation: ChatConversation) -> None:
    await db.execute(delete(ChatMessage).where(ChatMessage.conversation_id == conversation.id))
    await db.delete(conversation)
    await db.commit()


# ── Admin Analytics ───────────────────────────────────────────────

async def get_aggregate_stats(db: AsyncSession) -> dict:
    total_users = await db.scalar(select(func.count(User.id)))
    total_sessions = await db.scalar(select(func.count(UserSession.id)))
    avg_stress = await db.scalar(select(func.avg(UserSession.stress_score)))
    pending_escalations = await db.scalar(
        select(func.count(EscalationFlag.id)).where(EscalationFlag.status == "pending")
    )
    total_conversations = await db.scalar(select(func.count(ChatConversation.id)))
    positive = await db.scalar(select(func.count(FeedbackEntry.id)).where(FeedbackEntry.rating > 0))
    total_fb = await db.scalar(select(func.count(FeedbackEntry.id)))
    return {
        "total_users": total_users or 0,
        "total_sessions": total_sessions or 0,
        "total_conversations": total_conversations or 0,
        "avg_stress_score": round(avg_stress or 0, 1),
        "pending_escalations": pending_escalations or 0,
        "feedback_count": total_fb or 0,
        "helpful_rate": round((positive or 0) / total_fb * 100, 1) if total_fb else None,
    }
