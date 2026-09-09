"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiAdminAnalytics } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#a855f7", "#3b82f6"];

export default function AdminPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiAdminAnalytics()
      .then(setData)
      .catch(() => setError("Admin access required or not signed in as admin."))
      .finally(() => setLoading(false));
  }, []);

  const catDist = data?.category_distribution as Record<string, number> || {};
  const avgStress = data?.avg_stress_by_category as Record<string, number> || {};
  const escalations = data?.escalation_queue as { escalation_id: string; user_id: string; reason: string; status: string; created_at: string }[] || [];

  const barData = Object.entries(catDist).map(([k, v]) => ({ name: k.replace(/_/g, " "), sessions: v }));

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            <span className="gradient-text">Counsellor Analytics</span>
          </h1>
          <p style={{ color: "rgba(241,245,249,0.6)", marginBottom: "2rem" }}>
            Anonymized aggregated stats across all users
          </p>

          {loading && <div className="spinner" style={{ margin: "4rem auto" }} />}
          {error && <div style={{ color: "#fca5a5", padding: "2rem", textAlign: "center", fontSize: "0.9rem" }}>
            {error}<br />
            <a href="/login" style={{ color: "#f59e0b", marginTop: "0.5rem", display: "inline-block" }}>Sign in as admin</a>
          </div>}

          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Stats row */}
              <div className="grid-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Total Users", value: data.total_users, color: "#a78bfa" },
                  { label: "Total Sessions", value: data.total_sessions, color: "#f59e0b" },
                  { label: "Avg Stress Score", value: `${data.avg_stress_score}/100`, color: "#f97316" },
                  { label: "Pending Escalations", value: data.pending_escalations, color: "#ef4444" },
                ].map(stat => (
                  <div key={stat.label} className="glass-card" style={{ padding: "1.25rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: stat.color }}>{String(stat.value)}</div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.55)", marginTop: "0.25rem" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid-2">
                <div className="glass-card" style={{ padding: "1.5rem" }}>
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Sessions by Debt Category</h3>
                  {barData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData}>
                        <XAxis dataKey="name" tick={{ fill: "rgba(241,245,249,0.4)", fontSize: 10 }} />
                        <YAxis tick={{ fill: "rgba(241,245,249,0.4)", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "rgba(15,12,41,0.95)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "0.5rem", color: "#f1f5f9" }} />
                        <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                          {barData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div style={{ color: "rgba(241,245,249,0.4)", textAlign: "center", padding: "2rem" }}>No data yet</div>}
                </div>

                <div className="glass-card" style={{ padding: "1.5rem" }}>
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Avg Stress by Category</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {Object.entries(avgStress).map(([cat, score], idx) => (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ width: 130, fontSize: "0.78rem", color: "rgba(241,245,249,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {cat.replace(/_/g, " ")}
                        </div>
                        <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4 }}>
                          <div style={{ width: `${score}%`, height: "100%", background: COLORS[idx % COLORS.length], borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: "0.78rem", color: COLORS[idx % COLORS.length], width: 35, textAlign: "right" }}>{score}</div>
                      </div>
                    ))}
                    {Object.keys(avgStress).length === 0 && <div style={{ color: "rgba(241,245,249,0.4)", textAlign: "center", padding: "1rem" }}>No data yet</div>}
                  </div>
                </div>
              </div>

              {/* Escalation queue */}
              <div className="glass-card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>
                  Escalation Queue
                  <span className="badge badge-crimson" style={{ marginLeft: "0.75rem" }}>{escalations.length}</span>
                </h3>
                {escalations.length === 0 ? (
                  <div style={{ color: "rgba(241,245,249,0.4)", textAlign: "center", padding: "2rem" }}>No pending escalations 🎉</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                          {["User ID", "Reason", "Status", "Created"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "0.625rem 1rem", color: "rgba(241,245,249,0.5)", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {escalations.map((esc) => (
                          <tr key={esc.escalation_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "0.625rem 1rem", fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(241,245,249,0.6)" }}>{esc.user_id}</td>
                            <td style={{ padding: "0.625rem 1rem" }}>{esc.reason}</td>
                            <td style={{ padding: "0.625rem 1rem" }}>
                              <span className="badge badge-crimson">{esc.status}</span>
                            </td>
                            <td style={{ padding: "0.625rem 1rem", color: "rgba(241,245,249,0.5)", fontSize: "0.8rem" }}>
                              {new Date(esc.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
