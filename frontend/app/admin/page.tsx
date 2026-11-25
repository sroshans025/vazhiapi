"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navbar from "@/components/Navbar";
import PageHero from "@/components/PageHero";
import { apiAdminAnalytics, apiUpdateEscalation, errorMessage } from "@/lib/api";
import { CATEGORY_META } from "@/lib/constants";
import { useAuth } from "@/lib/useAuth";

type Esc = { escalation_id: string; user_id: string; reason: string; status: string; assigned_to?: string; notes?: string; created_at: string; resolved_at?: string };
type Analytics = {
  total_users: number; total_sessions: number; total_conversations: number; avg_stress_score: number; pending_escalations: number;
  feedback_count: number; helpful_rate: number | null; category_distribution: Record<string, number>; avg_stress_by_category: Record<string, number>;
  crisis_distribution: Record<string, number>; escalation_queue: Esc[]; recently_resolved: Esc[];
};
const STATUS_BADGE: Record<string, string> = { pending: "badge-crimson", in_review: "badge-saffron", resolved: "badge-jade" };

export default function AdminPage() {
  const { user, ready } = useAuth(true);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiAdminAnalytics().then(setData).catch((e) => setError(errorMessage(e, "Admin access required."))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (ready && user) load(); }, [ready, user, load]);

  const update = async (id: string, status: string) => {
    const notes = status === "resolved" ? prompt("Resolution notes (optional)") ?? undefined : undefined;
    try { await apiUpdateEscalation(id, { status, notes }); load(); } catch (e) { setError(errorMessage(e)); }
  };

  const barData = data ? Object.entries(data.category_distribution).map(([k, v]) => ({ name: CATEGORY_META[k]?.label ?? k, sessions: v, color: CATEGORY_META[k]?.color ?? "#f59e0b" })) : [];

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <PageHero eyebrow="Counsellor console" title={<span className="gradient-text">Analytics & escalations</span>} subtitle="Anonymised, aggregated across all users." />
          {loading && <div className="spinner" style={{ margin: "4rem auto" }} />}
          {error && <div className="error-box">{error} {!user?.is_admin && <>· <Link href="/login">Sign in as admin</Link></>}</div>}

          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="grid-4">
                {[
                  { l: "Users", v: data.total_users, c: "#a78bfa" },
                  { l: "Check-ins", v: data.total_sessions, c: "#f59e0b" },
                  { l: "Avg stress", v: `${data.avg_stress_score}`, c: "#f97316" },
                  { l: "Pending escalations", v: data.pending_escalations, c: "#ef4444" },
                  { l: "Conversations", v: data.total_conversations, c: "#3b82f6" },
                  { l: "Feedback received", v: data.feedback_count, c: "#14b8a6" },
                  { l: "Rated helpful", v: data.helpful_rate == null ? "—" : `${data.helpful_rate}%`, c: "#10b981" },
                  { l: "Crisis-flagged check-ins", v: (data.crisis_distribution.critical ?? 0) + (data.crisis_distribution.severe ?? 0), c: "#ec4899" },
                ].map((s) => (
                  <div key={s.l} className="glass-card" style={{ padding: "1.1rem", textAlign: "center" }}>
                    <div className="stat-num" style={{ color: s.c }}>{String(s.v)}</div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2">
                <div className="glass-card card-pad">
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Check-ins by debt type</h3>
                  {barData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={barData}>
                        <XAxis dataKey="name" tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: "rgba(241,245,249,0.45)", fontSize: 10 }} width={30} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "rgba(15,12,41,0.95)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "0.5rem", color: "#f1f5f9" }} />
                        <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>{barData.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="muted" style={{ textAlign: "center", padding: "2rem" }}>No data yet</div>}
                </div>
                <div className="glass-card card-pad">
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Average stress by debt type</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {Object.entries(data.avg_stress_by_category).sort((a, b) => b[1] - a[1]).map(([cat, score]) => (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ width: 120, fontSize: "0.78rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} className="muted">{CATEGORY_META[cat]?.icon} {CATEGORY_META[cat]?.label ?? cat}</div>
                        <div className="bar" style={{ flex: 1, height: 8 }}><div style={{ width: `${score}%`, background: CATEGORY_META[cat]?.color }} /></div>
                        <div style={{ fontSize: "0.78rem", width: 34, textAlign: "right" }}>{score}</div>
                      </div>
                    ))}
                    {!Object.keys(data.avg_stress_by_category).length && <div className="muted" style={{ textAlign: "center" }}>No data yet</div>}
                  </div>
                </div>
              </div>

              <div className="glass-card card-pad">
                <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Escalation queue <span className="badge badge-crimson" style={{ marginLeft: "0.5rem" }}>{data.escalation_queue.length}</span></h3>
                {data.escalation_queue.length === 0 ? <div className="muted" style={{ textAlign: "center", padding: "2rem" }}>No open escalations 🎉</div> : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="table">
                      <thead><tr><th>User</th><th>Reason</th><th>Status</th><th>Assigned</th><th>Created</th><th>Actions</th></tr></thead>
                      <tbody>{data.escalation_queue.map((e) => (
                        <tr key={e.escalation_id}>
                          <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }} className="muted">{e.user_id}</td>
                          <td>{e.reason}</td>
                          <td><span className={`badge ${STATUS_BADGE[e.status]}`}>{e.status.replace("_", " ")}</span></td>
                          <td className="muted">{e.assigned_to ?? "—"}</td>
                          <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString("en-IN")}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {e.status === "pending" && <button className="btn-ghost btn-sm" onClick={() => update(e.escalation_id, "in_review")}>Take</button>}{" "}
                            <button className="btn-primary btn-sm" onClick={() => update(e.escalation_id, "resolved")}>Resolve</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {data.recently_resolved.length > 0 && (
                  <details style={{ marginTop: "1rem" }}>
                    <summary className="muted" style={{ cursor: "pointer", fontSize: "0.85rem" }}>Recently resolved ({data.recently_resolved.length})</summary>
                    <ul style={{ marginTop: "0.6rem", paddingLeft: "1.2rem", fontSize: "0.82rem" }}>
                      {data.recently_resolved.map((e) => <li key={e.escalation_id}>{e.reason}: {e.notes || "resolved"} <span className="muted">({e.resolved_at ? new Date(e.resolved_at).toLocaleDateString("en-IN") : ""})</span></li>)}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
