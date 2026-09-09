# VazhiAPI — வழி

> **நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness**

An AI-powered Tamil Nadu Financial Wellness Platform. It reads a user's financial distress in their own words, scores stress in real time, classifies the exact type of debt trap, predicts crisis trajectory, generates culturally-aware responses, and matches them to the correct Tamil Nadu government scheme or legal aid path.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, SQLite, Python 3.11 |
| ML Pipeline | TensorFlow/Keras, PyTorch, Stable-Baselines3 |
| Deployment | Vercel (frontend) + any Python host (backend) |

---

## Project Structure

```
vazhiapi/
├── frontend/        # Next.js 16 + TypeScript app
├── backend/         # FastAPI + 6-Layer Deep Learning Pipeline
├── docs/            # Architecture & API reference
├── vercel.json      # Vercel auto-config (rootDirectory: frontend)
└── .env.example     # Environment variable template
```

---

## Quick Start — Local Development

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --port 8000
# Swagger UI → http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
cp ../.env.example .env.local   # then edit with your backend URL
npm install
npm run dev
# App → http://localhost:3000
```

### Docker Compose (full stack)

```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | URL of the deployed FastAPI backend. Defaults to `http://localhost:8000` in development. |

Copy `.env.example` to `frontend/.env.local` for local development.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → Import the `vazhiapi` repo.
3. Vercel auto-reads `vercel.json` and sets **Root Directory → `frontend`** automatically.
4. Add the environment variable **`NEXT_PUBLIC_API_URL`** pointing to your deployed backend.
5. Click **Deploy**.

> The backend (FastAPI) must be deployed separately (Railway, Render, Fly.io, or your own VPS) and its public URL set as `NEXT_PUBLIC_API_URL` on Vercel.

---

## Frontend Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/register` | Create account (name + district required) |
| `/login` | Sign in |
| `/checkin` | Chat-style financial check-in with live stress gauge |
| `/dashboard` | Wellness trends + matched government schemes |
| `/schemes` | Tamil Nadu scheme explorer with category filters |
| `/admin` | Counsellor analytics (admin only) |

---

## The 6-Layer Deep Learning Pipeline

| Layer | Model | Task |
|---|---|---|
| L1 | FFNN (TensorFlow/Keras) | Stress Scoring 0–100 |
| L2 | 1D TextCNN (TensorFlow/Keras) | TN Debt Category Classification |
| L3 | BiLSTM (PyTorch) | Session Crisis Trajectory |
| L4 | Seq2Seq + Bahdanau Attention (PyTorch) | Wellness Response Generation |
| L5 | PPO/DQN (Stable-Baselines3) | Intervention Strategy Optimization |
| L6 | Behaviour Cloning (PyTorch) | Counsellor Tone Refinement |

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/auth/register` | POST | Register new user |
| `/auth/login` | POST | JWT login |
| `/analyse` | POST | Full 6-layer pipeline analysis |
| `/chat` | POST | Multilingual wellness chat |
| `/history/{user_id}` | GET | Stress history |
| `/risk/{user_id}` | GET | Current risk score + trend |
| `/schemes` | GET | TN scheme matches |
| `/budget-plan` | POST | AI budget plan |
| `/summary/{user_id}` | GET | Counsellor session summary |
| `/feedback` | POST | RL reward signal |
| `/escalate/{user_id}` | POST | Human handoff flag |
| `/health` | GET | System health |
| `/dashboard/summary/{user_id}` | GET | Aggregated dashboard data |
| `/admin/analytics` | GET | Counsellor analytics |
| `/pipeline/debug/{request_id}` | GET | Per-layer debug outputs |
