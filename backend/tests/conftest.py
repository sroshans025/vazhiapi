import os
import sys
import tempfile
from pathlib import Path

# Isolated DB + forced local chat engine, set before the app is imported.
_tmp = Path(tempfile.mkdtemp(prefix="vazhi-test-"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["CHAT_LLM"] = "local"
os.environ["ADMIN_EMAIL"] = "admin@vazhiapi.in"
os.environ["ADMIN_PASSWORD"] = "adminpass123"
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from api.main import app, lifespan  # noqa: E402


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def client():
    async with lifespan(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


async def make_user(client, email: str, password: str = "password123") -> dict:
    r = await client.post("/auth/register", json={
        "email": email, "password": password, "full_name": "Test User", "district": "Madurai"})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "id": d["user_id"], "h": {"Authorization": f"Bearer {d['access_token']}"}}
