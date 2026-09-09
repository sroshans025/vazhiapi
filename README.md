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
