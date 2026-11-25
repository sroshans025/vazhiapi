"""
Chat — multi-turn counselling conversations
  POST   /chat                         → full reply (JSON)
  POST   /chat/stream                  → Server-Sent Events: meta, analysis, delta…, done
  GET    /chat/conversations           → list threads
  GET    /chat/conversations/{id}      → messages in a thread
  PATCH  /chat/conversations/{id}      → rename
  DELETE /chat/conversations/{id}      → delete thread
Each user message is analysed by the 6-layer pipeline (so the dashboard updates), then the
counsellor (Claude or the local engine) replies with the conversation as memory.
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.analyse import run_and_store
from counsel.engine import ChatContext, claude_available, generate_reply, suggestions_for
from core.dependencies import get_current_user, get_db
from database import crud
from database.session import async_session_maker

router = APIRouter(prefix="/chat")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    language: Literal["auto", "en", "ta", "tanglish"] = "auto"


class RenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)


def _analysis_summary(a: dict) -> dict:
    return {k: a.get(k) for k in (
        "session_id", "request_id", "stress_score", "stress_label", "debt_category", "debt_category_label",
        "debt_category_label_ta", "debt_category_icon", "debt_category_color", "crisis_trajectory",
        "predicted_peak_score", "rl_action", "rl_action_label", "rl_action_description", "language",
        "processing_time_ms", "matched_schemes", "helplines", "debt_category_probabilities",
    )} | {"crisis": a["crisis"]}


def _msg_out(m) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "session_id": m.session_id,
            "meta": m.meta or {}, "created_at": crud.iso(m.created_at)}


async def _prepare(payload: ChatRequest, db: AsyncSession, user):
    if payload.conversation_id:
        conv = await crud.get_conversation(db, payload.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = payload.message.strip().replace("\n", " ")
        conv = await crud.create_conversation(db, user.id, title=title[:60] + ("…" if len(title) > 60 else ""))

    history = [{"role": m.role, "content": m.content, "meta": m.meta or {}}
               for m in await crud.get_messages(db, conv.id)]

    analysis = await run_and_store(db, user, payload.message, conversation_id=conv.id)
    # Reply in the language they actually typed (preference only affects the UI chrome).
    lang = analysis["language"] if payload.language == "auto" else payload.language

    user_msg = await crud.add_message(db, conv, "user", payload.message, session_id=analysis["session_id"],
                                      meta={"analysis": _analysis_summary(analysis)})
    ctx = ChatContext(message=payload.message, language=lang, analysis=analysis, history=history,
                      user_name=user.full_name, district=user.district)
    return conv, user_msg, analysis, ctx


async def _finish(conv_id: str, ctx: ChatContext, text: str, engine: str, intent: str, analysis: dict):
    suggestions = suggestions_for(intent, analysis, ctx.language)
    meta = {
        "engine": engine, "intent": intent, "suggestions": suggestions,
        "category": analysis["debt_category"], "stress_score": analysis["stress_score"],
        "crisis_level": analysis["crisis"]["level"], "rl_action": analysis["rl_action"],
    }
    async with async_session_maker() as db:   # fresh session: the request's may be closed while streaming
        conv = await crud.get_conversation(db, conv_id)
        msg = await crud.add_message(db, conv, "assistant", text.strip(), session_id=analysis["session_id"], meta=meta)
    return msg, meta


@router.post("")
async def chat(payload: ChatRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    conv, user_msg, analysis, ctx = await _prepare(payload, db, current_user)
    parts, engine, intent = [], "vazhi-local", "distress"
    async for kind, value in generate_reply(ctx):
        if kind == "delta":
            parts.append(value)
        elif kind == "engine":
            engine = value
        elif kind == "intent":
            intent = value
    msg, meta = await _finish(conv.id, ctx, "".join(parts), engine, intent, analysis)
    return {
        "conversation_id": conv.id,
        "user_message": _msg_out(user_msg),
        "message": _msg_out(msg),
        "response": msg.content,
        "analysis": _analysis_summary(analysis),
        "suggestions": meta["suggestions"],
        "engine": engine,
        # v1-compatible fields
        "stress_score": analysis["stress_score"],
        "debt_category_label": analysis["debt_category_label"],
        "language": ctx.language,
    }


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def chat_stream(payload: ChatRequest, db: AsyncSession = Depends(get_db),
                      current_user=Depends(get_current_user)):
    conv, user_msg, analysis, ctx = await _prepare(payload, db, current_user)

    async def events() -> AsyncIterator[str]:
        yield _sse("meta", {"conversation_id": conv.id, "title": conv.title, "user_message": _msg_out(user_msg)})
        yield _sse("analysis", _analysis_summary(analysis))
        parts, engine, intent = [], "vazhi-local", "distress"
        try:
            async for kind, value in generate_reply(ctx):
                if kind == "delta":
                    parts.append(value)
                    yield _sse("delta", {"text": value})
                elif kind == "engine":
                    engine = value
                elif kind == "intent":
                    intent = value
            msg, meta = await _finish(conv.id, ctx, "".join(parts), engine, intent, analysis)
            yield _sse("done", {"message": _msg_out(msg), "suggestions": meta["suggestions"], "engine": engine})
        except Exception as exc:  # never leave the client hanging
            yield _sse("error", {"detail": f"Reply failed: {type(exc).__name__}"})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/conversations")
async def list_conversations(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    rows = await crud.list_conversations(db, current_user.id)
    return {
        "engine": "claude" if claude_available() else "vazhi-local",
        "conversations": [
            {"id": r["conversation"].id, "title": r["conversation"].title or "New conversation",
             "message_count": r["message_count"], "created_at": crud.iso(r["conversation"].created_at),
             "updated_at": crud.iso(r["conversation"].updated_at)}
            for r in rows
        ],
    }


async def _owned(db, conversation_id: str, user):
    conv = await crud.get_conversation(db, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db),
                           current_user=Depends(get_current_user)):
    conv = await _owned(db, conversation_id, current_user)
    msgs = await crud.get_messages(db, conv.id)
    return {"id": conv.id, "title": conv.title, "created_at": crud.iso(conv.created_at),
            "messages": [_msg_out(m) for m in msgs]}


@router.patch("/conversations/{conversation_id}")
async def rename_conversation(conversation_id: str, payload: RenameRequest, db: AsyncSession = Depends(get_db),
                              current_user=Depends(get_current_user)):
    conv = await _owned(db, conversation_id, current_user)
    conv.title = payload.title.strip()
    await db.commit()
    return {"id": conv.id, "title": conv.title}


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db),
                              current_user=Depends(get_current_user)):
    conv = await _owned(db, conversation_id, current_user)
    await crud.delete_conversation(db, conv)
