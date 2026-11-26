"use client";
import { PhoneCall, Sprout, TriangleAlert } from "lucide-react";
import CategoryIcon, { TrendIcon } from "@/components/CategoryIcon";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navbar from "@/components/Navbar";
import PageHero from "@/components/PageHero";
import SchemeCard from "@/components/SchemeCard";
import StressGauge from "@/components/StressGauge";
import { apiDashboard, apiEscalate, apiHistory, errorMessage } from "@/lib/api";
import { CATEGORY_META, stressColor } from "@/lib/constants";
import { useAuth } from "@/lib/useAuth";
import { useLang } from "@/lib/i18n";
import type { DashboardSummary } from "@/types";

type HistRow = { session_id: string; created_at: string; input_preview: string; stress_score: number; stress_label: string; debt_category: string; crisis_level?: string };
const tooltipStyle = { background: "#ffffff", border: "1px solid var(--border)", borderRadius: "0.5rem", color: "var(--text)" };

export default function DashboardPage() {
  const { user, ready } = useAuth(true);
  const { lang } = useLang();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [esc, setEsc] = useState("");

  useEffect(() => {
    if (!ready || !user) return;
    Promise.all([apiDashboard(user.user_id), apiHistory(user.user_id)])
      .then(([d, h]) => { setData(d); setHistory(h.sessions.slice(0, 8)); })
      .catch((e) => setError(errorMessage(e, "Failed to load dashboard.")))
      .finally(() => setLoading(false));
  }, [ready, user]);

  const escalate = async () => {
    if (!user) return;
    try { setEsc((await apiEscalate(user.user_id, { reason: "Requested from dashboard" })).message); } catch (e) { setError(errorMessage(e)); }
  };

  const pieData = data ? Object.entries(data.category_breakdown).map(([k, v]) => ({ name: CATEGORY_META[k]?.label ?? k, value: v, color: CATEGORY_META[k]?.color ?? "var(--primary)" })) : [];
  const trendData = data?.stress_trend.map((p) => ({ ...p, label: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) })) ?? [];
  const info = data?.primary_category_info;

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <PageHero eyebrow={lang === "ta" ? "உங்கள் பயணம்" : "Your journey"}
            title={<><span className="gradient-text">{lang === "ta" ? "நல்வாழ்வு டாஷ்போர்டு" : "Wellness dashboard"}</span></>}
            subtitle={user?.full_name ? `${lang === "ta" ? "வணக்கம்" : "Vanakkam"}, ${user.full_name.split(" ")[0]}. Every chat message updates this view.` : undefined} />

          {loading && <div className="spinner" style={{ margin: "4rem auto" }} />}
          {error && <div className="error-box">{error}</div>}

          {data && !data.has_data && (
            <div className="glass-card" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
              <div style={{ marginBottom: "1rem" }}><Sprout size={40} color="var(--primary)" /></div>
              <h2 style={{ marginBottom: "0.75rem" }}>No check-ins yet</h2>
              <p className="muted" style={{ marginBottom: "1.5rem" }}>Start a conversation and your stress trend, debt types and matched schemes will appear here.</p>
              <Link href="/checkin" className="btn-primary">Start a check-in →</Link>
            </div>
          )}

          {data?.has_data && data.current_risk && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="grid-4">
                <div className="glass-card" style={{ padding: "1.25rem", textAlign: "center" }}>
                  <StressGauge score={data.current_risk.score} label={data.current_risk.label} size={120} caption="Latest stress" />
                </div>
                <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
                  <div className="stat-num" style={{ color: data.trend === "rising" ? "var(--danger)" : data.trend === "declining" ? "var(--success)" : "var(--primary)" }}>
                    <TrendIcon t={data.trend} size={30} />
                  </div>
                  <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{data.trend === "declining" ? "Improving" : data.trend}</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>avg {data.average_score} · best {data.best_score}</div>
                </div>
                <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
                  <div className="stat-num" style={{ color: "var(--primary)" }}>{data.session_count}</div>
                  <div style={{ fontWeight: 700 }}>Check-ins</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>last {data.last_session ? new Date(data.last_session).toLocaleDateString("en-IN") : "—"}</div>
                </div>
                <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem" }}><CategoryIcon id={data.primary_category ?? "general_financial_stress"} size={24} tile /></div>
                  <div style={{ fontWeight: 700, color: info?.color }}>{lang === "ta" ? info?.label_ta : info?.label}</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>Primary concern</div>
                </div>
              </div>

              <div className="grid-2">
                <div className="glass-card card-pad">
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Stress over time</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData}>
                      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="var(--surface-2)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} width={30} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/100`, "Stress"]} />
                      <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} fill="url(#sg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="glass-card card-pad">
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Debt types discussed</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                        {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "center" }}>
                    {pieData.map((d) => <span key={d.name} style={{ fontSize: "0.75rem" }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: d.color, marginRight: 5 }} />{d.name} ({d.value})</span>)}
                  </div>
                </div>
              </div>

              {info?.first_steps?.length ? (
                <div className="glass-card card-pad">
                  <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Your next steps · {lang === "ta" ? info.label_ta : info.label}</h3>
                  <ol style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {(lang === "ta" ? info.first_steps_ta : info.first_steps).map((s) => <li key={s} style={{ lineHeight: 1.6 }}>{s}</li>)}
                  </ol>
                </div>
              ) : null}

              <div className="glass-card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontWeight: 600 }}>Recent check-ins</h3><Link href="/checkin" style={{ fontSize: "0.85rem" }}>Open chat →</Link>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead><tr><th>When</th><th>What you said</th><th>Type</th><th>Stress</th></tr></thead>
                    <tbody>{history.map((h) => (
                      <tr key={h.session_id}>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(h.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td style={{ maxWidth: 380 }}>{h.input_preview}</td>
                        <td style={{ whiteSpace: "nowrap" }}><CategoryIcon id={h.debt_category} size={15} /> {CATEGORY_META[h.debt_category]?.label}</td>
                        <td><b style={{ color: stressColor(h.stress_score) }}>{Math.round(h.stress_score)}</b>{h.crisis_level && h.crisis_level !== "low" && <span title={h.crisis_level}> <TriangleAlert size={14} color="var(--danger)" className="icon" /></span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Schemes matched to you</h2><Link href="/schemes" style={{ fontSize: "0.85rem" }}>View all →</Link>
                </div>
                <div className="grid-2">{data.matched_schemes.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
              </div>

              <div className="glass-card card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Need a human to talk to?</div>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>{esc || "We'll flag your account for a trained counsellor to follow up."}</div>
                </div>
                <button className="btn-danger" onClick={escalate} disabled={!!esc}>{esc ? "Requested" : <><PhoneCall size={16} /> Talk to a counsellor</>}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
