"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRegister, errorMessage, isNetworkError } from "@/lib/api";
import GuestEntry from "@/components/GuestEntry";
import { saveSession } from "@/lib/auth";
import { TN_DISTRICTS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [form, setForm] = useState({ email: "", password: "", full_name: "", district: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const pwOk = form.password.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwOk) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      saveSession(await apiRegister({ ...form, email: form.email.trim(), full_name: form.full_name.trim(), preferred_language: lang }));
      router.push("/checkin");
    } catch (err) {
      setOffline(isNetworkError(err));
      setError(errorMessage(err, "Registration failed. Please try again."));
    } finally { setLoading(false); }
  };

  return (
    <main className="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="hero-orb" style={{ width: 380, height: 380, background: "#f59e0b", bottom: -120, right: -100, opacity: 0.2 }} />
      <div style={{ width: "100%", maxWidth: 480, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.375rem" }}>Join <span className="gradient-text">VazhiAPI</span></h1>
          <p className="muted">Free · confidential · no judgement</p>
        </div>
        <div className="glass-card" style={{ padding: "2rem" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="label" htmlFor="name">Name *</label>
              <input id="name" className="input-field" autoComplete="name" placeholder="Your name (a nickname is fine)" value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="district">District *</label>
              <select id="district" className="input-field" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} required>
                <option value="" disabled>Select district</option>
                {TN_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.3rem" }}>Used to point you to your district legal-aid office.</div>
            </div>
            <div>
              <label className="label" htmlFor="email">Email *</label>
              <input id="email" className="input-field" type="email" autoComplete="email" placeholder="your@email.com" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label" htmlFor="pw">Password *</label>
              <input id="pw" className="input-field" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
              {form.password && <div className="bar" style={{ marginTop: "0.4rem" }}><div style={{ width: `${Math.min(100, form.password.length * 8)}%`, background: pwOk ? "#10b981" : "#f59e0b" }} /></div>}
            </div>
            {error && <div className="error-box" role="alert">{error}</div>}
            {offline && <GuestEntry prominent name={form.full_name} district={form.district} />}
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Creating account…" : <span>Create account · <span className="font-tamil">வழி தொடங்கு</span> →</span>}
            </button>
          </form>
          {!offline && (
            <div style={{ marginTop: "1.25rem" }}>
              <div className="muted" style={{ textAlign: "center", fontSize: "0.75rem", marginBottom: "0.6rem" }}>or</div>
              <GuestEntry name={form.full_name} district={form.district} />
            </div>
          )}
          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem" }} className="muted">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
