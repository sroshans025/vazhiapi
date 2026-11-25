"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageHero from "@/components/PageHero";
import { apiDeleteMe, apiMe, apiUpdateMe, errorMessage } from "@/lib/api";
import { clearSession, updateStoredUser } from "@/lib/auth";
import { TN_DISTRICTS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, ready } = useAuth(true);
  const { setLang } = useLang();
  const [form, setForm] = useState({ full_name: "", district: "", preferred_language: "en" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState("");

  useEffect(() => {
    if (!ready || !user) return;
    apiMe().then((u) => setForm({ full_name: u.full_name ?? "", district: u.district ?? "", preferred_language: u.preferred_language ?? "en" })).catch(() => {});
  }, [ready, user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(""); setErr("");
    try {
      const u = await apiUpdateMe(form);
      updateStoredUser(u);
      setLang(u.preferred_language === "ta" ? "ta" : "en");
      setMsg("Profile saved.");
    } catch (e2) { setErr(errorMessage(e2)); }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(""); setErr("");
    try { await apiUpdateMe(pw); setPw({ current_password: "", new_password: "" }); setMsg("Password changed."); }
    catch (e2) { setErr(errorMessage(e2)); }
  };

  const del = async () => {
    try { await apiDeleteMe(); clearSession(); router.push("/"); } catch (e2) { setErr(errorMessage(e2)); }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container" style={{ maxWidth: 760 }}>
          <PageHero eyebrow="Account" title={<span className="gradient-text">Your profile & privacy</span>} subtitle={user?.email} />
          {msg && <div className="ok-box" style={{ marginBottom: "1rem" }}>✓ {msg}</div>}
          {err && <div className="error-box" style={{ marginBottom: "1rem" }}>{err}</div>}

          <form onSubmit={save} className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
            <h3 style={{ fontWeight: 700 }}>Details</h3>
            <div><label className="label">Name</label><input className="input-field" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} maxLength={120} /></div>
            <div><label className="label">District</label>
              <select className="input-field" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}>
                {!TN_DISTRICTS.includes(form.district) && form.district && <option value={form.district}>{form.district}</option>}
                {TN_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><label className="label">App language</label>
              <div className="tabs" style={{ marginBottom: 0 }}>
                {[["en", "English"], ["ta", "தமிழ்"]].map(([k, l]) => <button type="button" key={k} className={`chip ${form.preferred_language === k ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, preferred_language: k }))}>{l}</button>)}
              </div></div>
            <button className="btn-primary" style={{ alignSelf: "flex-start" }}>Save</button>
          </form>

          <form onSubmit={changePw} className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
            <h3 style={{ fontWeight: 700 }}>Change password</h3>
            <input className="input-field" type="password" autoComplete="current-password" placeholder="Current password" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} required />
            <input className="input-field" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" minLength={8} value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} required />
            <button className="btn-ghost" style={{ alignSelf: "flex-start" }}>Update password</button>
          </form>

          <div className="glass-card card-pad" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
            <h3 style={{ fontWeight: 700, color: "#fca5a5", marginBottom: "0.4rem" }}>Delete my account</h3>
            <p className="muted" style={{ fontSize: "0.88rem", marginBottom: "0.9rem" }}>Permanently erases your account, every chat, check-in, feedback and counsellor request. This cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <input className="input-field" style={{ maxWidth: 260 }} placeholder='Type "DELETE" to confirm' value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} />
              <button className="btn-danger" disabled={confirmDel !== "DELETE"} onClick={del}>Delete everything</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
