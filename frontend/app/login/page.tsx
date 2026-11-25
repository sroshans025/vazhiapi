"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin, errorMessage } from "@/lib/api";
import { saveSession } from "@/lib/auth";

function nextPath() {
  if (typeof window === "undefined") return "/checkin";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/checkin";
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      saveSession(await apiLogin({ email: form.email.trim(), password: form.password }));
      router.push(nextPath());
    } catch (err) {
      setError(errorMessage(err, "Invalid email or password. Please try again."));
    } finally { setLoading(false); }
  };

  return (
    <main className="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="hero-orb" style={{ width: 380, height: 380, background: "#6d28d9", top: -100, left: -100 }} />
      <div style={{ width: "100%", maxWidth: 440, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <Link href="/" className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem", fontSize: "1.75rem", textDecoration: "none" }}>வ</Link>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.375rem" }}>Welcome back to <span className="gradient-text">VazhiAPI</span></h1>
          <p className="muted font-tamil">நம்ம பணம் நம்ம கையில்</p>
        </div>
        <div className="glass-card" style={{ padding: "2rem" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input-field" type="email" autoComplete="email" placeholder="your@email.com" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <div style={{ position: "relative" }}>
                <input id="pw" className="input-field" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required style={{ paddingRight: "4rem" }} />
                <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>{show ? "Hide" : "Show"}</button>
              </div>
            </div>
            {error && <div className="error-box" role="alert">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>{loading ? "Signing in…" : "Sign In →"}</button>
          </form>
          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem" }} className="muted">
            Don&apos;t have an account? <Link href="/register">Register free</Link>
          </p>
        </div>
        <p className="muted" style={{ textAlign: "center", fontSize: "0.78rem", marginTop: "1rem" }}>
          Just exploring? <Link href="/tools">Try the calculators</Link> or the <Link href="/">live demo</Link>, no account needed.
        </p>
      </div>
    </main>
  );
}
