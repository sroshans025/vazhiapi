import type { AuthUser, TokenResponse } from "@/types";

const TOKEN = "vazhi_token";
const USER = "vazhi_user";

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export const getToken = (): string | null =>
  typeof window === "undefined" ? null : safe(() => localStorage.getItem(TOKEN), null);

export const getUser = (): AuthUser | null =>
  typeof window === "undefined" ? null : safe(() => {
    const raw = localStorage.getItem(USER);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }, null);

export function saveSession(d: TokenResponse) {
  const { access_token, token_type: _t, ...user } = d;
  void _t;
  safe(() => {
    localStorage.setItem(TOKEN, access_token);
    localStorage.setItem(USER, JSON.stringify(user));
  }, undefined);
  window.dispatchEvent(new Event("vazhi-auth"));
}

export function updateStoredUser(u: Partial<AuthUser>) {
  const cur = getUser();
  if (!cur) return;
  safe(() => localStorage.setItem(USER, JSON.stringify({ ...cur, ...u })), undefined);
  window.dispatchEvent(new Event("vazhi-auth"));
}

export function clearSession() {
  safe(() => { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); }, undefined);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("vazhi-auth"));
}
