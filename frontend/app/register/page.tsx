"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRegister } from "@/lib/api";

const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
  "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "The Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi (Tuticorin)", "Tiruchirappalli",
  "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "", district: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await apiRegister(form);
      localStorage.setItem("vazhi_token", data.access_token);
      localStorage.setItem("vazhi_user", JSON.stringify({ user_id: data.user_id, email: data.email, full_name: data.full_name }));
      router.push("/checkin");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.375rem" }}>
            Join <span className="gradient-text">VazhiAPI</span>
          </h1>
          <p style={{ color: "rgba(241,245,249,0.55)", fontSize: "0.9rem" }}>Free · Anonymous by default · No judgment</p>
        </div>

        <div className="glass-card" style={{ padding: "2rem" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", display: "block", marginBottom: "0.375rem" }}>Name *</label>
              <input className="input-field" placeholder="Your full name" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", display: "block", marginBottom: "0.375rem" }}>District *</label>
              <select className="input-field" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} required style={{ color: form.district ? undefined : "rgba(241,245,249,0.45)" }}>
                <option value="" disabled style={{ color: "#1e293b" }}>Select district</option>
                {TN_DISTRICTS.map(d => <option key={d} value={d} style={{ color: "#1e293b", background: "#f1f5f9" }}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", display: "block", marginBottom: "0.375rem" }}>Email *</label>
              <input className="input-field" type="email" placeholder="your@email.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", display: "block", marginBottom: "0.375rem" }}>Password *</label>
              <input className="input-field" type="password" placeholder="Min 8 characters" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
            </div>

            {error && <div style={{ color: "#fca5a5", fontSize: "0.875rem", padding: "0.625rem", background: "rgba(239,68,68,0.1)", borderRadius: "0.5rem" }}>{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? "Creating account…" : "Create Account — வழி தொடங்கு →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "rgba(241,245,249,0.5)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#f59e0b" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
