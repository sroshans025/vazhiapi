"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await apiLogin(form);
      localStorage.setItem("vazhi_token", data.access_token);
      localStorage.setItem("vazhi_user", JSON.stringify({ user_id: data.user_id, email: data.email, full_name: data.full_name }));
      router.push("/checkin");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.75rem", fontWeight: 800, color: "#0f0c29",
          }}>வ</div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.375rem" }}>
            Welcome back to <span className="gradient-text">VazhiAPI</span>
          </h1>
          <p style={{ color: "rgba(241,245,249,0.55)", fontSize: "0.9rem" }}>
            நம்ம பணம் நம்ம கையில்
          </p>
        </div>

        <div className="glass-card" style={{ padding: "2rem" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", display: "block", marginBottom: "0.375rem" }}>Email</label>
              <input className="input-field" type="email" placeholder="your@email.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", display: "block", marginBottom: "0.375rem" }}>Password</label>
              <input className="input-field" type="password" placeholder="••••••••" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>

            {error && <div style={{ color: "#fca5a5", fontSize: "0.875rem", padding: "0.625rem", background: "rgba(239,68,68,0.1)", borderRadius: "0.5rem" }}>{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "rgba(241,245,249,0.5)" }}>
            Don't have an account?{" "}
            <Link href="/register" style={{ color: "#f59e0b" }}>Register free</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
