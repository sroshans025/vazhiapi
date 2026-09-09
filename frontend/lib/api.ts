/**
 * VazhiAPI — Axios API Client
 * Typed wrappers for all 14 backend endpoints
 */
import axios from "axios";
import type { TokenResponse, AnalyseRequest, PipelineResult, DashboardSummary, GovernmentScheme } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("vazhi_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("vazhi_token");
      localStorage.removeItem("vazhi_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const apiRegister = (data: { email: string; password: string; full_name?: string; district?: string }) =>
  api.post<TokenResponse>("/auth/register", data).then((r) => r.data);

export const apiLogin = (data: { email: string; password: string }) =>
  api.post<TokenResponse>("/auth/login", data).then((r) => r.data);

// ── Core Pipeline ─────────────────────────────────────────────────
export const apiAnalyse = (data: AnalyseRequest) =>
  api.post<PipelineResult>("/analyse", data).then((r) => r.data);

export const apiChat = (message: string) =>
  api.post<{ response: string; stress_score: number; debt_category_label: string }>("/chat", { message }).then((r) => r.data);

// ── User Data ─────────────────────────────────────────────────────
export const apiHistory = (userId: string) =>
  api.get(`/history/${userId}`).then((r) => r.data);

export const apiRisk = (userId: string) =>
  api.get(`/risk/${userId}`).then((r) => r.data);

export const apiDashboard = (userId: string) =>
  api.get<DashboardSummary>(`/dashboard/summary/${userId}`).then((r) => r.data);

export const apiSummary = (userId: string) =>
  api.get(`/summary/${userId}`).then((r) => r.data);

// ── TN Context ────────────────────────────────────────────────────
export const apiSchemes = (category?: string) =>
  api.get<{ schemes: GovernmentScheme[] }>(`/schemes${category ? `?category=${category}` : ""}`).then((r) => r.data);

export const apiBudgetPlan = (data: { monthly_income: number; debt_emi: number; debt_category: string; num_dependents?: number }) =>
  api.post("/budget-plan", data).then((r) => r.data);

// ── RL + Crisis ───────────────────────────────────────────────────
export const apiFeedback = (data: { session_id: string; rating: 1 | -1; comment?: string }) =>
  api.post("/feedback", data).then((r) => r.data);

export const apiEscalate = (userId: string, data?: { reason?: string; session_id?: string }) =>
  api.post(`/escalate/${userId}`, data || {}).then((r) => r.data);

// ── Admin + Debug ─────────────────────────────────────────────────
export const apiAdminAnalytics = () =>
  api.get("/admin/analytics").then((r) => r.data);

export const apiPipelineDebug = (requestId: string) =>
  api.get(`/pipeline/debug/${requestId}`).then((r) => r.data);

export const apiHealth = () =>
  api.get("/health").then((r) => r.data);
