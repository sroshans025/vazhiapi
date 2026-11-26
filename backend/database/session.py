"""
Database Session Factory — async SQLAlchemy
"""
import logging

import uuid

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.config import IS_SERVERLESS, get_settings

settings = get_settings()
log = logging.getLogger("vazhi")


def engine_options(database_url: str, serverless: bool = IS_SERVERLESS) -> tuple[str, dict]:
    """
    Build (url, create_async_engine kwargs).
    Postgres: libpq-style query params (sslmode, channel_binding — present in Neon / Vercel
    Postgres URLs) are not understood by asyncpg, so translate them into connect_args.
    PgBouncer / Neon pooled endpoints can't use prepared-statement caches.
    Serverless: no connection pool kept across invocations (NullPool).
    """
    url = make_url(database_url)
    kwargs: dict = {"echo": settings.DEBUG}
    if url.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
        return url.render_as_string(hide_password=False), kwargs

    query = dict(url.query)
    sslmode = str(query.pop("sslmode", "") or "")
    query.pop("channel_binding", None)
    pgbouncer = str(query.pop("pgbouncer", "")).lower() == "true" or "pooler" in (url.host or "")
    if pgbouncer:
        query["prepared_statement_cache_size"] = "0"      # SQLAlchemy asyncpg dialect option
    url = url.set(query=query)

    connect_args: dict = {}
    if sslmode in ("require", "verify-ca", "verify-full") or (url.host and url.host not in ("localhost", "127.0.0.1", "postgres")):
        connect_args["ssl"] = "require" if sslmode in ("", "require") else sslmode
    if pgbouncer:
        connect_args["statement_cache_size"] = 0          # asyncpg's own cache
        connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4()}__"
    kwargs["connect_args"] = connect_args
    if serverless:
        kwargs["poolclass"] = NullPool
    else:
        kwargs["pool_pre_ping"] = True
    return url.render_as_string(hide_password=False), kwargs


_url, _engine_kwargs = engine_options(settings.DATABASE_URL)
engine = create_async_engine(_url, **_engine_kwargs)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _add_missing_columns(sync_conn) -> None:
    """
    Tiny forward-only migration: create_all() never alters existing tables, so databases
    created by v1 would be missing the new columns. Add any that are absent (all nullable).
    """
    from database.models import Base

    insp = inspect(sync_conn)
    existing_tables = set(insp.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in have:
                continue
            col_type = col.type.compile(dialect=sync_conn.dialect)
            sync_conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN "{col.name}" {col_type}'))
            log.info("migrated: added %s.%s", table.name, col.name)


async def create_all_tables():
    from database.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
