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
| Chat | Claude (`claude-opus-5-5`) when `ANTHROPIC_API_KEY` is set, otherwise the built-in bilingual counsellor |

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                                  # set SECRET_KEY; optional ANTHROPIC_API_KEY, ADMIN_EMAIL/PASSWORD
uvicorn api.main:app --reload --port 8000             # trains the lite models on first boot (~1 s)
pytest                                                # 12 API tests on an isolated temp DB

# Frontend
cd frontend
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
npm run dev                                           # http://localhost:3000
```

Or run everything with `docker compose up --build` (Postgres + backend + frontend).

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
* `backend/datasets/vazhi_distress_corpus.jsonl`: 1,440 labelled English/Tamil/Tanglish distress messages (category + stress). Regenerate with `python -m training.corpus`, retrain with `python -m training.train_lite`. Metrics are measured on held-out situation templates (currently ~48% category accuracy across 12 classes, stress MAE ~7); at serving time L2 blends the model with curated indicators.

Scheme benefits change with government orders. The app tells users to confirm on official portals.
