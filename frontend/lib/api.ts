/**
 * VazhiAPI — API client (axios for JSON, fetch for the SSE chat stream)
 */
import axios from "axios";
import type {
  AnalyseRequest, AnalysisSummary, AuthUser, ChatMessage, ConversationSummary, DashboardSummary,
  DebtCategory, GovernmentScheme, Helpline, Law, PipelineResult, TokenResponse,
} from "@/types";
import { clearSession, getToken } from "@/lib/auth";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const api = axios.create({ baseURL: API_BASE, timeout: 30000, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired session → back to login. Never for the auth endpoints themselves: v1 redirected on a
// failed *login* (401), reloading the page and swallowing the "invalid password" message.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url || "";
    if (err.response?.status === 401 && typeof window !== "undefined" && !url.startsWith("/auth/login") && !url.startsWith("/auth/register")) {
      clearSession();
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?next=${next}`;
    }
    return Promise.reject(err);
  }
);

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = e as { response?: { data?: { detail?: unknown } }; message?: string; code?: string };
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return `${d[0].loc?.slice(-1)[0] ?? "field"}: ${d[0].msg}`;
  if (err.code === "ERR_NETWORK") return "Can't reach the VazhiAPI server. Check your connection or try again shortly.";
  return fallback;
}

// ── Auth ──────────────────────────────────────────────────────────
export const apiRegister = (data: { email: string; password: string; full_name: string; district: string; preferred_language?: string }) =>
  api.post<TokenResponse>("/auth/register", data).then((r) => r.data);
export const apiLogin = (data: { email: string; password: string }) =>
  api.post<TokenResponse>("/auth/login", data).then((r) => r.data);
export const apiMe = () => api.get<AuthUser>("/auth/me").then((r) => r.data);
export const apiUpdateMe = (data: Partial<{ full_name: string; district: string; preferred_language: string; current_password: string; new_password: string }>) =>
  api.patch<AuthUser>("/auth/me", data).then((r) => r.data);
export const apiDeleteMe = () => api.delete("/auth/me");

// ── Pipeline + chat ───────────────────────────────────────────────
export const apiAnalyse = (data: AnalyseRequest) => api.post<PipelineResult>("/analyse", data).then((r) => r.data);
export const apiDemoAnalyse = (text: string) => api.post<AnalysisSummary>("/demo/analyse", { text }).then((r) => r.data);

export const apiConversations = () =>
  api.get<{ engine: string; conversations: ConversationSummary[] }>("/chat/conversations").then((r) => r.data);
export const apiConversation = (id: string) =>
  api.get<{ id: string; title: string; messages: ChatMessage[] }>(`/chat/conversations/${id}`).then((r) => r.data);
export const apiRenameConversation = (id: string, title: string) => api.patch(`/chat/conversations/${id}`, { title });
export const apiDeleteConversation = (id: string) => api.delete(`/chat/conversations/${id}`);

export interface StreamHandlers {
  onMeta?: (d: { conversation_id: string; title: string; user_message: ChatMessage }) => void;
  onAnalysis?: (a: AnalysisSummary) => void;
  onDelta?: (text: string) => void;
  onDone?: (d: { message: ChatMessage; suggestions: string[]; engine: string }) => void;
  onError?: (detail: string) => void;
}

/** POST /chat/stream and dispatch Server-Sent Events. Resolves when the stream ends. */
export async function streamChat(
  body: { message: string; conversation_id?: string | null; language?: string },
  h: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login?next=/checkin";
    return;
  }
  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`;
    try { const j = await res.json(); if (typeof j.detail === "string") detail = j.detail; } catch {}
    throw new Error(detail);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message", data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      const payload = JSON.parse(data);
      if (event === "meta") h.onMeta?.(payload);
      else if (event === "analysis") h.onAnalysis?.(payload);
      else if (event === "delta") h.onDelta?.(payload.text);
      else if (event === "done") h.onDone?.(payload);
      else if (event === "error") h.onError?.(payload.detail);
    }
  }
}

// ── User data ─────────────────────────────────────────────────────
export const apiHistory = (userId: string) => api.get(`/history/${userId}`).then((r) => r.data);
export const apiRisk = (userId: string) => api.get(`/risk/${userId}`).then((r) => r.data);
export const apiDashboard = (userId: string) => api.get<DashboardSummary>(`/dashboard/summary/${userId}`).then((r) => r.data);
export const apiSummary = (userId: string) => api.get(`/summary/${userId}`).then((r) => r.data);

// ── Knowledge (public) ────────────────────────────────────────────
export const apiSchemes = (params?: { category?: string; q?: string; level?: string }) =>
  api.get<{ schemes: GovernmentScheme[]; count: number; total: number }>("/schemes", { params }).then((r) => r.data);
export const apiMatchSchemes = (profile: Record<string, unknown>) =>
  api.post<{ schemes: GovernmentScheme[] }>("/schemes/match", profile).then((r) => r.data);
export const apiCategories = () => api.get<{ categories: DebtCategory[] }>("/knowledge/categories").then((r) => r.data);
export const apiCategory = (id: string) =>
  api.get<DebtCategory & { schemes: GovernmentScheme[]; laws: Law[]; helplines: Helpline[] }>(`/knowledge/categories/${id}`).then((r) => r.data);
export const apiLaws = () => api.get<{ laws: Law[] }>("/knowledge/laws").then((r) => r.data);
export const apiHelplines = () => api.get<{ helplines: Helpline[] }>("/knowledge/helplines").then((r) => r.data);

// ── Tools (public) ────────────────────────────────────────────────
export const apiInterest = (d: { rate: number; period: string; principal?: number; months?: number }) =>
  api.post("/tools/interest", d).then((r) => r.data);
export const apiEMI = (d: { principal: number; annual_rate: number; months: number }) => api.post("/tools/emi", d).then((r) => r.data);
export const apiPayoff = (d: { monthly_budget: number; strategy: string; debts: { name: string; balance: number; annual_rate: number; min_payment: number }[] }) =>
  api.post("/tools/payoff", d).then((r) => r.data);
export const apiBudgetPlan = (d: { monthly_income: number; debt_emi: number; debt_category: string; num_dependents?: number; rent?: number }) =>
  api.post("/budget-plan", d).then((r) => r.data);

// ── RL + crisis ───────────────────────────────────────────────────
export const apiFeedback = (d: { session_id: string; rating: 1 | -1; message_id?: string; comment?: string }) =>
  api.post("/feedback", d).then((r) => r.data);
export const apiEscalate = (userId: string, d?: { reason?: string; session_id?: string }) =>
  api.post(`/escalate/${userId}`, d || {}).then((r) => r.data);

// ── Admin + debug ─────────────────────────────────────────────────
export const apiAdminAnalytics = () => api.get("/admin/analytics").then((r) => r.data);
export const apiUpdateEscalation = (id: string, d: { status?: string; notes?: string; assigned_to?: string }) =>
  api.patch(`/admin/escalations/${id}`, d).then((r) => r.data);
export const apiPipelineDebug = (requestId: string) => api.get(`/pipeline/debug/${requestId}`).then((r) => r.data);
export const apiHealth = () => api.get("/health").then((r) => r.data);
