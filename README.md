# VazhiAPI — வழி

> **நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness**

An AI-powered Tamil Nadu Financial Wellness Platform that reads a user's financial distress in their own words, scores their stress in real time, classifies the exact type of debt trap, predicts crisis trajectory, generates culturally-aware responses, and matches them to the correct Tamil Nadu government scheme or legal aid path.

## Architecture

```
vazhiapi/
├── backend/    # FastAPI + 6-Layer Deep Learning Pipeline
├── frontend/   # Next.js 14 + TypeScript + Tailwind CSS
└── docs/       # Architecture, API Reference, Viva Demo Script
```

## Quick Start

### Local Development (no Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --port 8000
# API docs at http://localhost:8000/docs
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App at http://localhost:3000
```

### Docker Compose (full stack)
```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

## The 6-Layer Deep Learning Pipeline

| Layer | Syllabus Unit | Model | Task |
|---|---|---|---|
| L1 | Unit I | FFNN (TensorFlow/Keras) | Stress Scoring (0–100) |
| L2 | Unit II | 1D TextCNN (TensorFlow/Keras) | TN Debt Category Classification |
| L3 | Unit III-A | BiLSTM (PyTorch) | Session Crisis Trajectory |
| L4 | Unit III-B | Seq2Seq + Bahdanau Attention (PyTorch) | Wellness Response Generation |
| L5 | Unit IV | PPO/DQN (Stable-Baselines3) | Intervention Strategy Optimization |
| L6 | Unit V | Behaviour Cloning (PyTorch) | Counsellor Tone Refinement |

## API Endpoints (14 total)

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

## Frontend Pages

- **/** — Landing page with Tamil tagline and feature overview
- **/checkin** — Chat-style financial check-in with live stress gauge
- **/dashboard** — Wellness trends, scheme cards, budget plan
- **/schemes** — Tamil Nadu scheme explorer
- **/observability** — Model layer debug panel (viva demo tool)
- **/admin** — Counsellor analytics dashboard

## Datasets (Applied Deep Learning AM4502)

1. FinancialPhraseBank (Kaggle) → FFNN stress features
2. Reddit r/personalfinanceindia (scraped) → CNN debt patterns
3. RBI Consumer Complaints (RBI Portal) → CNN distress text
4. EmpatheticDialogues (Facebook AI) → BiLSTM context
5. Counsel Chat Dataset → Seq2Seq response generation
6. UCI Household Finance (UCI ML) → DRL financial environment
7. TN Govt Scheme Docs (TN Portal) → Scheme matcher
8. SHG Counsellor Transcripts (NGO Partners) → Imitation learning

## Course Mapping (AM4502)

- **Unit I** → L1 FFNN Stress Scorer
- **Unit II** → L2 TextCNN Debt Classifier
- **Unit III** → L3 BiLSTM + L4 Seq2Seq+Attention
- **Unit IV** → L5 PPO/DQN Strategy Optimizer
- **Unit V** → L6 Behaviour Cloning Refiner
"# vazhiapi" 
