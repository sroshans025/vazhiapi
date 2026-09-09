"use client";
import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/Navbar";
import StressGauge from "@/components/StressGauge";
import { apiAnalyse, apiFeedback } from "@/lib/api";
import type { PipelineResult } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  blade_finance: "#ef4444",
  chit_fund_default: "#f97316",
  gold_loan_overdue: "#eab308",
  agricultural_debt: "#22c55e",
  wedding_debt: "#a855f7",
  festival_credit: "#3b82f6",
};

const ACTION_ICONS: Record<string, string> = {
  validate: "🤝",
  legal_rights: "⚖️",
  shg_alternative: "🏦",
  escalate: "🚨",
};

export default function CheckinPage() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string; result?: PipelineResult }[]>([
    { role: "ai", content: "வணக்கம்! Hello! I'm VazhiAPI — describe your financial situation in Tamil or English. Everything is confidential and shame-free. 🛡️" },
  ]);

  const submit = async () => {
    if (!text.trim() || isLoading) return;
    const userMsg = text;
    setText("");
    setError("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);
    setFeedbackSent(false);

    try {
      const data = await apiAnalyse({ text: userMsg, include_debug: true });
      setResult(data);
      setMessages(prev => [...prev, { role: "ai", content: data.refined_response, result: data }]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      if (err.response?.data?.detail === "Invalid or expired token" ||
          err.response?.data?.detail?.includes("token")) {
        setError("Please sign in to use the check-in feature.");
      } else {
        setError("Analysis failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendFeedback = async (rating: 1 | -1) => {
    if (!result || feedbackSent) return;
    try {
      await apiFeedback({ session_id: result.request_id, rating });
      setFeedbackSent(true);
    } catch {}
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <div className="content-container" style={{ flex: 1, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 80px)" }}>

          {/* Header */}
          <div style={{ padding: "1.5rem 0 1rem", flexShrink: 0 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              <span className="gradient-text">Financial Wellness Check-In</span>
            </h1>
            <p style={{ color: "rgba(241,245,249,0.6)", fontSize: "0.875rem" }}>
              Describe your situation in Tamil or English. AI analyses across 6 deep learning layers.
            </p>
          </div>

          <div style={{ flex: 1, display: "flex", gap: "1.5rem", overflow: "hidden" }}>
            {/* Chat column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Messages */}
              <div style={{
                flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem",
                padding: "0 0.25rem 1rem",
              }}>
                {messages.map((msg, idx) => (
                  <div key={idx}>
                    {msg.role === "user" ? (
                      <div className="chat-bubble-user">
                        <p style={{ fontSize: "0.95rem" }}>{msg.content}</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div className="chat-bubble-ai">
                          <p style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>{msg.content}</p>
                        </div>

                        {/* Inline result badges */}
                        {msg.result && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", paddingLeft: "0.5rem" }}>
                            <span className="badge badge-saffron">
                              Stress: {msg.result.stress_score}/100
                            </span>
                            <span className="badge" style={{
                              background: `${CATEGORY_COLORS[msg.result.debt_category]}22`,
                              color: CATEGORY_COLORS[msg.result.debt_category],
                              border: `1px solid ${CATEGORY_COLORS[msg.result.debt_category]}44`,
                            }}>
                              {msg.result.debt_category_label}
                            </span>
                            <span className="badge badge-violet">
                              {ACTION_ICONS[msg.result.rl_action]} {msg.result.rl_action_label}
                            </span>
                          </div>
                        )}

                        {/* Feedback (last AI message only) */}
                        {msg.result && idx === messages.length - 1 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingLeft: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.5)" }}>Was this helpful?</span>
                            {!feedbackSent ? (
                              <>
                                <button onClick={() => sendFeedback(1)} className="btn-ghost"
                                  style={{ padding: "0.25rem 0.75rem", fontSize: "0.875rem" }}>👍</button>
                                <button onClick={() => sendFeedback(-1)} className="btn-ghost"
                                  style={{ padding: "0.25rem 0.75rem", fontSize: "0.875rem" }}>👎</button>
                              </>
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: "#34d399" }}>✓ Feedback sent — RL reward updated!</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="chat-bubble-ai" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div className="spinner" />
                    <span style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.6)" }}>Running 6-layer pipeline…</span>
                  </div>
                )}

                {error && (
                  <div style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem", color: "#fca5a5",
                  }}>{error}</div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ flexShrink: 0, paddingTop: "1rem" }}>
                <div style={{ position: "relative" }}>
                  <textarea
                    className="input-field"
                    style={{ paddingRight: "6rem", minHeight: 90 }}
                    placeholder="Describe your financial situation... (Tamil or English) / உங்கள் நிதி நிலைமையை விவரிக்கவும்..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
                  />
                  <button
                    onClick={submit}
                    disabled={!text.trim() || isLoading}
                    className="btn-primary"
                    style={{
                      position: "absolute", right: "0.75rem", bottom: "0.75rem",
                      padding: "0.5rem 1.125rem", fontSize: "0.875rem",
                      opacity: (!text.trim() || isLoading) ? 0.5 : 1,
                    }}
                  >
                    Analyse
                  </button>
                </div>

              </div>
            </div>

            {/* Sidebar — live result panel */}
            {result && (
              <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
                {/* Stress Gauge */}
                <div className="glass-card" style={{ padding: "1.25rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.75rem", color: "rgba(241,245,249,0.5)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    L1 · Stress Score
                  </p>
                  <StressGauge score={result.stress_score} label={result.stress_label} />
                </div>

                {/* Category */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "rgba(241,245,249,0.5)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    L2 · Debt Category
                  </p>
                  <div style={{ fontWeight: 700, color: CATEGORY_COLORS[result.debt_category] }}>
                    {result.debt_category_label}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.5)", marginTop: "0.25rem" }}>
                    {Math.round(result.debt_category_probabilities[result.debt_category] * 100)}% confidence
                  </div>
                </div>

                {/* Trajectory */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "rgba(241,245,249,0.5)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    L3 · Crisis Trajectory
                  </p>
                  <div style={{ fontWeight: 700, color: result.crisis_trajectory === "Rising" ? "#ef4444" : result.crisis_trajectory === "Declining" ? "#10b981" : "#f59e0b" }}>
                    {result.crisis_trajectory === "Rising" ? "↗ " : result.crisis_trajectory === "Declining" ? "↘ " : "→ "}
                    {result.crisis_trajectory}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.5)" }}>
                    Peak: {result.predicted_peak_score}/100
                  </div>
                </div>

                {/* RL Action */}
                <div className="glass-card" style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "rgba(241,245,249,0.5)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    L5 · RL Strategy
                  </p>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {ACTION_ICONS[result.rl_action]} {result.rl_action_label}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.6)", marginTop: "0.375rem", lineHeight: 1.5 }}>
                    {result.rl_action_description}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
