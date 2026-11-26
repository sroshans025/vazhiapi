# VazhiAPI — வழி

> **நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness**

An AI-powered Tamil Nadu financial wellness platform. It reads a user's financial distress in their own words (English, Tamil or Tanglish), scores stress in real time, classifies 12 Tamil Nadu debt traps, tracks the crisis trajectory, and counsels them through a multi-turn chat grounded in 24 government schemes, 14 laws and verified helplines.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, Recharts |
| Backend | FastAPI, SQLAlchemy (async), SQLite / Postgres, Python 3.11+ |
| ML (serving) | scikit-learn models trained on the VazhiAPI distress corpus, rules, knowledge base |
| ML (deep track) | TensorFlow / PyTorch / Stable-Baselines3 architectures in `backend/models` |
| Chat | Optional LLM chat via the Anthropic API when `ANTHROPIC_API_KEY` is set, otherwise the built-in bilingual counsellor |

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt                   # runtime + scikit-learn (training) + pytest
cp .env.example .env                                  # set SECRET_KEY; optional ANTHROPIC_API_KEY, ADMIN_EMAIL/PASSWORD
uvicorn api.main:app --reload --port 8000
pytest                                                # 13 API tests on an isolated temp DB

# Frontend
cd frontend
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
npm run dev                                           # http://localhost:3000
```

Or run everything with `docker compose up --build` (Postgres + backend + frontend).

## Deploying on Vercel (frontend + backend)

The frontend and backend are two Vercel projects from this one repository.

**Backend** (FastAPI, zero-config):
1. Vercel → *Add New → Project* → import this repo → set **Root Directory** to `backend`. Vercel detects FastAPI; `backend/pyproject.toml` points it at `api.main:app`.
2. *Storage* → create a **Neon Postgres** database and connect it to the backend project (this sets `DATABASE_URL` / `POSTGRES_URL`; Neon's `sslmode` / pooler URLs are handled automatically). Without a database the API still runs, but accounts live in a temporary SQLite file that resets.
3. Environment variables: `SECRET_KEY` (long random string). Optional: `ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Deploy, then open `https://<backend-project>.vercel.app/health`.

**Frontend**: in the existing frontend project set `NEXT_PUBLIC_API_URL=https://<backend-project>.vercel.app` and redeploy.

The API needs no scikit-learn at runtime: the trained models ship as `backend/models/lite_portable.npz` (NumPy only). After retraining (`python -m training.train_lite`, which re-exports and verifies it), commit that file.

## Frontend routes

| Route | Description |
|---|---|
| `/` | Interactive landing: live AI demo (no sign-up), debt-trap calculator, 12-category explorer, 6-layer pipeline, schemes marquee |
| `/checkin` | Counselling chat: streaming replies, conversation history, suggestion chips, voice input (Tamil/English), feedback, live analysis panel, crisis banner, human escalation |
| `/dashboard` | Stress trend, debt types, next steps, recent check-ins, matched schemes |
| `/schemes` | 24 TN + central schemes with search, filters and an eligibility **Scheme Finder** |
| `/tools` | True-interest-rate converter, EMI calculator, avalanche/snowball payoff planner, budget planner |
| `/rights` | Laws in plain language and free helplines |
| `/profile` | Profile, language, password, delete account and all data |
| `/admin` | Analytics and escalation queue management (admins only) |

## API (highlights; full docs at `/docs`)

| Endpoint | Description |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `GET/PATCH/DELETE /auth/me` | Auth, profile, delete account |
| `POST /chat/stream` | Server-Sent Events chat: `meta`, `analysis`, `delta`…, `done` |
| `POST /chat`, `GET/PATCH/DELETE /chat/conversations[/{id}]` | Non-streaming chat and conversation management |
| `POST /analyse` | Full 6-layer pipeline (stored as a check-in) |
| `POST /demo/analyse` | Public, rate-limited, nothing stored |
| `GET /schemes`, `POST /schemes/match`, `GET /knowledge/{categories,laws,helplines,districts}` | Public knowledge base |
| `POST /tools/{interest,emi,payoff}`, `POST /budget-plan` | Calculators |
| `POST /feedback`, `POST /escalate/{user_id}` | RL reward signal, human handoff |
| `GET /dashboard/summary/{id}`, `/history/{id}`, `/risk/{id}`, `/summary/{id}` | User data |
| `GET /admin/analytics`, `PATCH /admin/escalations/{id}` | Counsellor console |
| `GET /pipeline/debug/{request_id}`, `GET /health` | Observability |

## Datasets

* `backend/tn_context/*.json`: debt categories (12), government schemes (24), laws (14), helplines (14), all bilingual.
* `backend/tn_context/faq.json`: 66 Q&A entries (budgeting, saving, banking, UPI fraud and scams, credit scores, loans, recovery-agent rules, police complaints, Lok Adalat, loan apps, schemes and documents, health insurance, jobs and PF, gambling, stress, family and abuse, farming, gold, housing) with English/Tamil/Tanglish keywords. The chat retrieves from it (BM25-style search over Q&A + schemes + laws + categories).
* `backend/datasets/vazhi_distress_corpus.jsonl`: 1,745 labelled messages: trilingual distress messages plus neutral and information-seeking ones, so calm questions score low stress. Regenerate with `python -m training.corpus`, retrain with `python -m training.train_lite`. Metrics are measured on held-out phrasings (currently ~45% category accuracy across 12 classes, stress MAE ~8); at serving time L2 blends the model with curated indicators.
* After editing any of these, run `python -m training.export_kb` to refresh `frontend/lib/kb.json`, the copy the website uses offline.

## Guest mode (no account, no server)

Login and register offer **"Continue without an account"**, and suggest it automatically when the server can't be reached. In guest mode the chat, dashboard and profile run entirely in the browser (`frontend/lib/guest.ts`, `counsellor.ts`, `offline.ts`) on the bundled knowledge base, and data stays in that browser's localStorage. With the backend and an `ANTHROPIC_API_KEY`, signed-in users get the LLM-powered chat, which can answer any question, grounded in the same knowledge base.

Scheme benefits change with government orders. The app tells users to confirm on official portals.
