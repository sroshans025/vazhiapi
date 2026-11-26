/**
 * VazhiAPI — API client (axios for JSON, fetch for the SSE chat stream)
 */
import axios from "axios";
import type {
  AnalyseRequest, AnalysisSummary, AuthUser, ChatMessage, ConversationSummary, DashboardSummary,
  DebtCategory, GovernmentScheme, Helpline, Law, PipelineResult, TokenResponse,
} from "@/types";
import { clearSession, getToken } from "@/lib/auth";
import * as offline from "@/lib/offline";
import * as guest from "@/lib/guest";

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
  if (err.code === "ERR_NETWORK") return "The VazhiAPI server isn't reachable right now. You can still continue without an account; the chat works on this device.";
  return fallback;
}

const resolve = <T,>(fn: () => T): Promise<T> => new Promise((ok, fail) => { try { ok(fn()); } catch (e) { fail(e); } });

/** True when an error means "the server could not be reached" (vs a real 4xx answer). */
export const isNetworkError = (e: unknown) => {
  const err = e as { response?: unknown; code?: string; message?: string };
  return !err.response && (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED" || /network|timeout/i.test(err.message ?? ""));
};

// ── Auth ──────────────────────────────────────────────────────────
export const apiRegister = (data: { email: string; password: string; full_name: string; district: string; preferred_language?: string }) =>
  api.post<TokenResponse>("/auth/register", data).then((r) => r.data);
export const apiLogin = (data: { email: string; password: string }) =>
  api.post<TokenResponse>("/auth/login", data).then((r) => r.data);
export const apiMe = () => (guest.isGuest() ? Promise.resolve(guest.guestMe()) : api.get<AuthUser>("/auth/me").then((r) => r.data));
export const apiUpdateMe = (data: Partial<{ full_name: string; district: string; preferred_language: string; current_password: string; new_password: string }>) =>
  guest.isGuest() ? Promise.resolve(guest.guestUpdateMe(data as Partial<AuthUser>)) : api.patch<AuthUser>("/auth/me", data).then((r) => r.data);
export const apiDeleteMe = () => (guest.isGuest() ? Promise.resolve(guest.guestDeleteAll()) : api.delete("/auth/me"));

// ── Pipeline + chat ───────────────────────────────────────────────
export const apiAnalyse = (data: AnalyseRequest) => api.post<PipelineResult>("/analyse", data).then((r) => r.data);
/** Live demo: the real 6-layer backend when reachable, otherwise the in-browser analyser. */
export async function apiDemoAnalyse(text: string): Promise<AnalysisSummary & { offline?: boolean }> {
  try {
    return (await api.post<AnalysisSummary>("/demo/analyse", { text }, { timeout: 6000 })).data;
  } catch (e) {
    const err = e as { response?: { status: number } };
    if (err.response?.status === 422) throw e;          // genuine validation error
    return { ...offline.analyzeLocal(text), offline: true };
  }
}

export const apiConversations = () => guest.isGuest() ? Promise.resolve(guest.guestConversations()) :
  api.get<{ engine: string; conversations: ConversationSummary[] }>("/chat/conversations").then((r) => r.data);
export const apiConversation = (id: string) => guest.isGuest() ? resolve(() => guest.guestConversation(id)) :
  api.get<{ id: string; title: string; messages: ChatMessage[] }>(`/chat/conversations/${id}`).then((r) => r.data);
export const apiRenameConversation = (id: string, title: string) => (guest.isGuest() ? resolve(() => guest.guestRename(id, title)) : api.patch(`/chat/conversations/${id}`, { title }));
export const apiDeleteConversation = (id: string) => (guest.isGuest() ? resolve(() => guest.guestDeleteConversation(id)) : api.delete(`/chat/conversations/${id}`));

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
  if (guest.isGuest()) return guest.guestStreamChat(body, h, signal);
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
export const apiHistory = (userId: string) => (guest.isGuest() ? Promise.resolve(guest.guestHistory()) : api.get(`/history/${userId}`).then((r) => r.data));
export const apiRisk = (userId: string) => api.get(`/risk/${userId}`).then((r) => r.data);
export const apiDashboard = (userId: string) => (guest.isGuest() ? Promise.resolve(guest.guestDashboard()) : api.get<DashboardSummary>(`/dashboard/summary/${userId}`).then((r) => r.data));
export const apiSummary = (userId: string) => api.get(`/summary/${userId}`).then((r) => r.data);

// ── Knowledge (public) ────────────────────────────────────────────
// The public knowledge base ships with the frontend (lib/kb.json, exported from the backend by
// `python -m training.export_kb`), so these pages render instantly and work with no backend.
// The same data is served by the API at /schemes and /knowledge/* for other clients.
export const apiSchemes = (params?: { category?: string; q?: string; level?: string }) =>
  resolve(() => offline.filterSchemes(params) as { schemes: GovernmentScheme[]; count: number; total: number });
export const apiMatchSchemes = (profile: Record<string, unknown>) => resolve(() => offline.matchSchemes(profile));
export const apiCategories = () => resolve(() => ({ categories: offline.kb.categories as DebtCategory[] }));
export const apiCategory = (id: string) => resolve(() => {
  const c = offline.kb.categories.find((x) => x.id === id);
  if (!c) throw new Error("Category not found");
  return { ...c, schemes: offline.schemesFor(id), laws: offline.lawsFor(id), helplines: offline.helplinesFor([id], 4) } as DebtCategory & { schemes: GovernmentScheme[]; laws: Law[]; helplines: Helpline[] };
});
export const apiLaws = () => resolve(() => ({ laws: offline.kb.laws }));
export const apiHelplines = () => resolve(() => ({ helplines: offline.kb.helplines }));

// ── Tools (public, pure maths — computed in the browser, identical to /tools/* on the API) ──
/* eslint-disable @typescript-eslint/no-explicit-any */
export const apiInterest = (d: { rate: number; period: string; principal?: number; months?: number }) => resolve<any>(() => offline.interest(d));
export const apiEMI = (d: { principal: number; annual_rate: number; months: number }) => resolve<any>(() => offline.emi(d));
export const apiPayoff = (d: { monthly_budget: number; strategy: string; debts: { name: string; balance: number; annual_rate: number; min_payment: number }[] }) =>
  resolve<any>(() => offline.payoff(d));
export const apiBudgetPlan = (d: { monthly_income: number; debt_emi: number; debt_category: string; num_dependents?: number; rent?: number }) =>
  resolve<any>(() => offline.budgetPlan(d));
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── RL + crisis ───────────────────────────────────────────────────
export const apiFeedback = (d: { session_id: string; rating: 1 | -1; message_id?: string; comment?: string }) =>
  guest.isGuest() ? Promise.resolve({ rating: d.rating }) : api.post("/feedback", d).then((r) => r.data);
export const apiEscalate = (userId: string, d?: { reason?: string; session_id?: string }) =>
  guest.isGuest() ? Promise.resolve(guest.guestEscalate()) : api.post(`/escalate/${userId}`, d || {}).then((r) => r.data);

// ── Admin + debug ─────────────────────────────────────────────────
export const apiAdminAnalytics = () => api.get("/admin/analytics").then((r) => r.data);
export const apiUpdateEscalation = (id: string, d: { status?: string; notes?: string; assigned_to?: string }) =>
  api.patch(`/admin/escalations/${id}`, d).then((r) => r.data);
export const apiPipelineDebug = (requestId: string) => api.get(`/pipeline/debug/${requestId}`).then((r) => r.data);
export const apiHealth = () => api.get("/health").then((r) => r.data);
