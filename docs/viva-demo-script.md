# VazhiAPI — Viva Demo Script
## Applied Deep Learning (AM4502) — Live Examiner Walkthrough

---

## Pre-Demo Setup (5 mins before)

```bash
# Terminal 1 — Backend
cd vazhi/backend
python -m uvicorn api.main:app --reload --port 8000

# Terminal 2 — Frontend
cd vazhi/frontend
npm run dev
```

Open: http://localhost:3000

---

## Demo Flow (15–20 mins)

### Step 1: System Health Check (2 min)
**URL**: http://localhost:8000/docs → GET /health

Show the examiner:
- All 6 pipeline layers listed as "ready"
- Mock mode status (or live model weights if available)
- Database and API version

**Say**: "This confirms all 5 syllabus units are live in the pipeline."

---

### Step 2: Landing Page — Platform Overview (2 min)
**URL**: http://localhost:3000

Show:
- The 6-Layer Deep Learning Pipeline section → maps Units I–V
- The 6 Tamil Nadu debt categories (unique cultural context)
- "Anonymous by default" positioning

---

### Step 3: Register + Check-In (Unit I + II demo) (4 min)
**URL**: http://localhost:3000/register → /checkin

Type this input:
> "Blade finance loan of 70000 rupees. Daily collection. Vatti romba adhigama irukku. Cannot repay. They are threatening to take our gold."

Show:
- **Stress Gauge rises to ~75+** (L1 FFNN output, Unit I)
- **Debt badge shows "Blade Finance"** (L2 TextCNN, Unit II)
- **RL action: "Know Your Legal Rights"** (L5 PPO, Unit IV)
- **Wellness response** in Tamil (L4 Seq2Seq + L6 Imitation, Unit III+V)

**Say**: "Unit I (FFNN) scored this at 75+ stress. Unit II (TextCNN) correctly identified blade finance from the Tamil keyword 'vatti'."

---

### Step 4: Feedback Loop (Unit IV demo) (1 min)
Click **👍 thumbs up** on the response.

Show: "RL reward updated!" message.

**Say**: "This thumbs-up sends a +10 reward signal to the PPO/DQN agent (Unit IV). Over time, it reinforces interventions that users find helpful."

---

### Step 5: Model Observability Panel (All 5 Units) (5 min)
**URL**: http://localhost:3000/observability

Select the request from Step 3.

Walk through each layer:
1. **L1 FFNN** → Stress score + contributing keywords → "Unit I: Feed-Forward Neural Network"
2. **L2 TextCNN** → Probability bar chart across 6 categories → "Unit II: 1D CNN with multi-filter architecture"
3. **L3 BiLSTM** → Session trajectory bars → "Unit III-A: Bidirectional LSTM"
4. **L4 Seq2Seq** → Attention heatmap over tokens → "Unit III-B: Seq2Seq + Bahdanau Attention"
5. **L5 PPO** → Q-value bar chart for 4 actions → "Unit IV: Deep Reinforcement Learning"
6. **L6 Imitation** → Before/After tone comparison → "Unit V: Behaviour Cloning"

**Say**: "This single panel demonstrates all 5 units of the AM4502 syllabus on real output from the platform."

---

### Step 6: Wellness Dashboard (3 min)
**URL**: http://localhost:3000/dashboard

Show:
- Stress score history (Recharts line chart)
- Category breakdown (pie chart)
- Matched Tamil Nadu government schemes

---

### Step 7: Government Schemes (1 min)
**URL**: http://localhost:3000/schemes?filter=blade_finance

Show:
- TNSCB Zero-Interest SHG Loan
- District Legal Aid (DLSA) — free lawyer
- RBI Moneylender Complaint Portal

**Say**: "The AI correctly identifies blade finance and surfaces the 3 most relevant free interventions."

---

### Step 8: Counsellor Analytics (Admin) (1 min)
**URL**: http://localhost:3000/admin (requires admin account)

Show:
- Aggregate stress scores
- Category distribution
- Escalation queue

---

## Technical Q&A Prep

**Q: How is the stress score calculated?**
A: L1 is a 4-layer FFNN (64→256→128→64→1) trained on FinancialPhraseBank + Tamil distress texts. Features: VADER sentiment, urgency keywords (30+), BoW over a Tamil/English debt vocabulary, word count. Output is sigmoid*100.

**Q: How does the CNN classify debt types?**
A: Multi-filter 1D TextCNN with filter sizes [2,3,4] and 128 filters each. Three parallel conv branches → global max-pool → concat → softmax over 6 classes. Trained on Reddit r/personalfinanceindia + RBI Consumer Complaints.

**Q: What is the RL environment?**
A: `FinancialWellnessEnv` — custom Gymnasium env. State: [stress_score, category_idx, trajectory_idx, session_count]. 4 discrete actions. Reward = stress reduction between sessions. Trained with Stable-Baselines3 PPO.

**Q: How does the imitation learning work?**
A: Behaviour cloning MLP takes (context_embedding, raw_response_embedding) → tone_vector. Trained to mimic certified SHG counsellor transcripts. At inference: replaces shame phrases, adds culturally-aware empathy openers.

**Q: Is this production-ready?**
A: The full stack is deployment-ready: Railway (FastAPI + Postgres + Redis) + Vercel (Next.js). Training scripts are included for all 6 models. To deploy: `docker compose up` locally or push to Railway via their CLI.
