"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiDashboard, apiSchemes } from "@/lib/api";
import type { DashboardSummary, GovernmentScheme } from "@/types";
import SchemeCard from "@/components/SchemeCard";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#a855f7", "#3b82f6"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("vazhi_user") || "{}");
    if (!user.user_id) { setError("Please sign in."); setLoading(false); return; }

    Promise.all([
      apiDashboard(user.user_id),
      apiSchemes(),
    ]).then(([dashData, schemesData]) => {
      setData(dashData);
      setSchemes(schemesData.schemes.slice(0, 4));
    }).catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const stressColor = (score: number) =>
    score >= 75 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 25 ? "#eab308" : "#10b981";

  const pieData = data?.category_breakdown
    ? Object.entries(data.category_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            <span className="gradient-text">Wellness Dashboard</span>
          </h1>
          <p style={{ color: "rgba(241,245,249,0.6)", marginBottom: "2rem" }}>
            Your financial health journey — powered by BiLSTM session tracking
          </p>

          {loading && <div className="spinner" style={{ margin: "4rem auto" }} />}
          {error && <div style={{ color: "#fca5a5", padding: "2rem", textAlign: "center" }}>{error}</div>}

          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Top stats */}
              {data.current_risk && (
                <div className="grid-3">
                  <div className="glass-card" style={{ padding: "1.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", fontWeight: 800, color: stressColor(data.current_risk.score) }}>
                      {data.current_risk.score}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.6)" }}>Current Stress Score</div>
                    <div className={`badge badge-${data.current_risk.score >= 75 ? "crimson" : data.current_risk.score >= 50 ? "saffron" : "jade"}`} style={{ margin: "0.5rem auto 0" }}>
                      {data.current_risk.label}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: "1.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#a78bfa", marginBottom: "0.25rem" }}>
                      {data.session_count}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.6)" }}>Check-In Sessions</div>
                    <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", color: "rgba(241,245,249,0.4)" }}>
                      Trajectory: {data.current_risk.trajectory}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: "1.5rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f59e0b", marginBottom: "0.25rem" }}>
                      {data.current_risk.category?.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.6)" }}>Primary Debt Type</div>
                    <a href="/schemes" style={{ fontSize: "0.8rem", color: "#f59e0b", marginTop: "0.5rem", display: "block" }}>
                      View matching schemes →
                    </a>
                  </div>
                </div>
              )}

              {/* Charts row */}
              <div className="grid-2">
                {/* Stress trend */}
                {data.stress_trend.length > 0 && (
                  <div className="glass-card" style={{ padding: "1.5rem" }}>
                    <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Stress Score Trend</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={data.stress_trend}>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[0, 100]} tick={{ fill: "rgba(241,245,249,0.4)", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "rgba(15,12,41,0.95)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "0.5rem", color: "#f1f5f9" }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(v: any) => [`${v ?? 0}/100`, "Stress"]}
                        />
                        <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Category breakdown */}
                {pieData.length > 0 && (
                  <div className="glass-card" style={{ padding: "1.5rem" }}>
                    <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Debt Category Breakdown</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "rgba(15,12,41,0.95)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "0.5rem", color: "#f1f5f9" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Matched Schemes */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Matched Government Schemes</h2>
                  <a href="/schemes" style={{ fontSize: "0.875rem", color: "#f59e0b" }}>View all →</a>
                </div>
                <div className="grid-2">
                  {schemes.map(scheme => <SchemeCard key={scheme.id} scheme={scheme} />)}
                </div>
              </div>

              {/* Escalation button */}
              <div className="glass-card" style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Need immediate human support?</div>
                  <div style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.6)" }}>Connect to a certified TN financial counsellor</div>
                </div>
                <a href="/checkin">
                  <button className="btn-danger">🚨 Talk to a Counsellor</button>
                </a>
              </div>
            </div>
          )}

          {!loading && data && !data.has_data && (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🌱</div>
              <h2 style={{ marginBottom: "1rem" }}>No sessions yet</h2>
              <p style={{ color: "rgba(241,245,249,0.6)", marginBottom: "1.5rem" }}>Start your first check-in to see your wellness dashboard</p>
              <a href="/checkin"><button className="btn-primary">Start Check-In →</button></a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
