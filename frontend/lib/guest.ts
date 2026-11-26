/**
 * Guest mode — use VazhiAPI with no account and no server. Conversations, check-ins and the
 * profile live only in this browser (localStorage). Mirrors the shapes of the real API so the
 * pages don't need to know which mode they're in.
 */
import type { AnalysisSummary, AuthUser, ChatMessage, ConversationSummary, DashboardSummary, MsgLanguage } from "@/types";
import { getUser, saveSession, updateStoredUser } from "@/lib/auth";
import { analyzeLocal, helplinesFor, kb, schemesFor } from "@/lib/offline";
import { reply, suggestionsFor } from "@/lib/counsellor";
import type { StreamHandlers } from "@/lib/api";

export const GUEST_ID = "guest";
const KEY = "vazhi_guest_store";

type Conv = ConversationSummary & { messages: ChatMessage[] };
type Sess = { session_id: string; request_id: string; created_at: string; input_preview: string; stress_score: number; stress_label: string; debt_category: string; crisis_level: string; crisis_trajectory: string; conversation_id: string };
type Store = { conversations: Conv[]; sessions: Sess[] };

export const isGuest = () => getUser()?.user_id === GUEST_ID;

export function startGuest(opts?: { name?: string; district?: string; lang?: "en" | "ta" }) {
  saveSession({
    access_token: "guest", token_type: "guest", user_id: GUEST_ID, email: "guest (this device)",
    full_name: opts?.name || "Guest", district: opts?.district || null, preferred_language: opts?.lang || "en", is_admin: false,
  });
}

function load(): Store {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Store; } catch {}
  return { conversations: [], sessions: [] };
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify({ conversations: s.conversations.slice(0, 50), sessions: s.sessions.slice(0, 300) })); } catch {}
}
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function trajectory(history: number[]): { t: "Rising" | "Stable" | "Declining"; peak: number } {
  if (history.length < 2) return { t: "Stable", peak: history.at(-1) ?? 50 };
  const recent = history.slice(-5), last = recent.at(-1)!, prev = recent.slice(0, -1);
  const trend = last - prev.reduce((a, b) => a + b, 0) / prev.length;
  return trend > 10 ? { t: "Rising", peak: Math.min(last + trend, 99) } : trend < -10 ? { t: "Declining", peak: Math.max(last, 20) } : { t: "Stable", peak: last };
}

// ── Chat ──────────────────────────────────────────────────────────
export async function guestStreamChat(body: { message: string; conversation_id?: string | null }, h: StreamHandlers, signal?: AbortSignal) {
  const store = load();
  const user = getUser();
  let conv = body.conversation_id ? store.conversations.find((c) => c.id === body.conversation_id) : undefined;
  if (!conv) {
    const title = body.message.replace(/\s+/g, " ").trim();
    conv = { id: uid(), title: title.slice(0, 60) + (title.length > 60 ? "…" : ""), message_count: 0, created_at: now(), updated_at: now(), messages: [] };
    store.conversations.unshift(conv);
  }
  const history = conv.messages.map((m) => ({ role: m.role, meta: m.meta }));

  const base = analyzeLocal(body.message);
  const past = store.sessions.slice(0, 10).reverse().map((s) => s.stress_score);
  const traj = trajectory([...past, base.stress_score]);
  const sessionId = uid();
  const analysis: AnalysisSummary = { ...base, session_id: sessionId, request_id: sessionId, crisis_trajectory: traj.t, predicted_peak_score: Math.round(traj.peak * 10) / 10 };

  const userMsg: ChatMessage = { id: uid(), role: "user", content: body.message, session_id: sessionId, created_at: now(), meta: { analysis } };
  conv.messages.push(userMsg);
  store.sessions.unshift({ session_id: sessionId, request_id: sessionId, created_at: now(), input_preview: body.message.slice(0, 120), stress_score: analysis.stress_score,
    stress_label: analysis.stress_label, debt_category: analysis.debt_category, crisis_level: analysis.crisis.level, crisis_trajectory: traj.t, conversation_id: conv.id });
  save(store);

  h.onMeta?.({ conversation_id: conv.id, title: conv.title, user_message: userMsg });
  await sleep(250);
  h.onAnalysis?.(analysis);

  const lang = analysis.language as MsgLanguage;
  const out = reply({ message: body.message, lang, a: analysis, history, name: user?.full_name, district: user?.district });
  const words = out.text.split(/(\s+)/);
  let sent = "", buf = "";
  for (const w of words) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    buf += w;
    if (buf.length >= 18) { h.onDelta?.(buf); sent += buf; buf = ""; await sleep(22); }
  }
  if (buf) { h.onDelta?.(buf); sent += buf; }

  const suggestions = suggestionsFor(out.intent, analysis, lang);
  const aiMsg: ChatMessage = { id: uid(), role: "assistant", content: sent.trim(), session_id: sessionId, created_at: now(),
    meta: { engine: "vazhi-browser", intent: out.intent, suggestions, category: analysis.debt_category, stress_score: analysis.stress_score, crisis_level: analysis.crisis.level } };
  const s2 = load();
  const c2 = s2.conversations.find((c) => c.id === conv!.id) ?? conv!;
  if (!s2.conversations.includes(c2)) s2.conversations.unshift(c2);
  if (!c2.messages.some((m) => m.id === userMsg.id)) c2.messages.push(userMsg);
  c2.messages.push(aiMsg);
  c2.message_count = c2.messages.length;
  c2.updated_at = now();
  s2.conversations.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  save(s2);
  h.onDone?.({ message: aiMsg, suggestions, engine: "vazhi-browser" });
}

export const guestConversations = () => ({
  engine: "vazhi-browser",
  conversations: load().conversations.map(({ messages, ...c }) => ({ ...c, message_count: messages.length })),
});
export function guestConversation(id: string) {
  const c = load().conversations.find((x) => x.id === id);
  if (!c) throw { response: { status: 404, data: { detail: "Conversation not found" } } };
  return { id: c.id, title: c.title, messages: c.messages };
}
export function guestRename(id: string, title: string) {
  const s = load(); const c = s.conversations.find((x) => x.id === id); if (c) c.title = title; save(s);
}
export function guestDeleteConversation(id: string) {
  const s = load(); s.conversations = s.conversations.filter((c) => c.id !== id); s.sessions = s.sessions.filter((x) => x.conversation_id !== id); save(s);
}

// ── Dashboard / history ───────────────────────────────────────────
export function guestHistory() {
  const sessions = load().sessions;
  return { user_id: GUEST_ID, session_count: sessions.length, sessions };
}
export function guestDashboard(): DashboardSummary {
  const sessions = load().sessions;
  if (!sessions.length) return { user_id: GUEST_ID, has_data: false, stress_trend: [], category_breakdown: {}, current_risk: null, session_count: 0, matched_schemes: kb.schemes.slice(0, 4) };
  const counts: Record<string, number> = {};
  for (const s of sessions) counts[s.debt_category] = (counts[s.debt_category] ?? 0) + 1;
  const primary = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const scores = sessions.map((s) => s.stress_score);
  const latest = sessions[0];
  const avgPrev = scores.length > 1 ? scores.slice(1).reduce((a, b) => a + b, 0) / (scores.length - 1) : latest.stress_score;
  const cat = kb.categories.find((c) => c.id === primary)!;
  return {
    user_id: GUEST_ID, has_data: true,
    stress_trend: sessions.slice(0, 30).reverse().map((s) => ({ date: s.created_at, score: s.stress_score, category: s.debt_category })),
    category_breakdown: counts,
    current_risk: { score: latest.stress_score, label: latest.stress_label, category: latest.debt_category, trajectory: latest.crisis_trajectory, crisis_level: latest.crisis_level },
    trend: latest.stress_score > avgPrev + 5 ? "rising" : latest.stress_score < avgPrev - 5 ? "declining" : "stable",
    average_score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10, best_score: Math.min(...scores),
    primary_category: primary,
    primary_category_info: { label: cat.label, label_ta: cat.label_ta, icon: cat.icon, color: cat.color, first_steps: cat.first_steps, first_steps_ta: cat.first_steps_ta },
    matched_schemes: schemesFor(primary, 4).length ? schemesFor(primary, 4) : kb.schemes.slice(0, 4),
    session_count: sessions.length, last_session: latest.created_at,
  };
}

// ── Profile / escalation ──────────────────────────────────────────
export const guestMe = (): AuthUser => getUser() ?? { user_id: GUEST_ID, email: "guest (this device)", full_name: "Guest" };
export function guestUpdateMe(d: Partial<AuthUser>): AuthUser {
  const { full_name, district, preferred_language } = d;
  updateStoredUser({ ...(full_name ? { full_name } : {}), ...(district ? { district } : {}), ...(preferred_language ? { preferred_language } : {}) });
  return guestMe();
}
export function guestDeleteAll() { try { localStorage.removeItem(KEY); localStorage.removeItem("vazhi_last_conv"); } catch {} }
export function guestEscalate() {
  return {
    escalation_id: "guest", status: "unavailable",
    message: "You're in guest mode, so there's no account for a counsellor to follow up on. Please call one of these free, confidential lines now: "
      + helplinesFor(["crisis", "stress"], 3).map((h) => `${h.name} ${h.number}`).join(" · "),
    helplines: Object.fromEntries(helplinesFor(["crisis", "stress"], 4).map((h) => [h.name, h.number])),
  };
}
