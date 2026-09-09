import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VazhiAPI — AI Financial Wellness for Tamil Nadu",
  description: "Tamil Nadu's AI-powered financial distress detection and counselling platform. நம்ம பணம் நம்ம கையில்.",
};

const DEBT_CATEGORIES = [
  { icon: "⚡", label: "Blade Finance", desc: "Daily collection moneylenders charging 730%+ interest", color: "#ef4444" },
  { icon: "🏦", label: "Chit Fund Default", desc: "Kuri/chit fund collapse or organizer absconding", color: "#f97316" },
  { icon: "💛", label: "Gold Loan Overdue", desc: "Jewel pawn overdue with auction risk", color: "#eab308" },
  { icon: "🌾", label: "Agricultural Debt", desc: "Crop loan and input credit crisis for farmers", color: "#22c55e" },
  { icon: "💍", label: "Wedding Debt", desc: "Kalyanam expenses from multiple moneylenders", color: "#a855f7" },
  { icon: "🪔", label: "Festival Credit", desc: "Pongal/Deepavali informal credit accumulation", color: "#3b82f6" },
];


export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh" }}>
      {/* ── Hero ──────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem 1.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decoration */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(109,40,217,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 800 }}>


          <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1rem" }}>
            <span className="gradient-text">VazhiAPI</span>
            <br />
            <span style={{ color: "#f1f5f9", fontSize: "clamp(1.2rem, 3vw, 2rem)", fontWeight: 600, fontFamily: "'Noto Sans Tamil', sans-serif" }}>
              நம்ம பணம் நம்ம கையில்
            </span>
          </h1>

          <p style={{ fontSize: "1.125rem", color: "rgba(241,245,249,0.75)", maxWidth: 600, margin: "0 auto 2.5rem", lineHeight: 1.8 }}>
            An AI platform that reads your financial distress in your own words, scores stress in real time,
            identifies the exact type of Tamil Nadu debt trap, and matches you to the right government scheme or legal aid.
          </p>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <Link href="/register">
              <button className="btn-primary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
                Start Confidential Check-In →
              </button>
            </Link>
          </div>

          <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "rgba(241,245,249,0.4)" }}>
            🔒 Anonymous by default · No shame · No judgment · Confidential
          </p>
        </div>
      </section>

      {/* ── Debt Categories ──────────────────────────── */}
      <section style={{ padding: "5rem 1.5rem", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              6 Tamil Nadu Debt Traps We Detect
            </h2>
            <p style={{ color: "rgba(241,245,249,0.6)" }}>Culturally-specific patterns missed by generic financial AI</p>
          </div>
          <div className="grid-3">
            {DEBT_CATEGORIES.map((cat) => (
              <div key={cat.label} className="glass-card" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{cat.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: cat.color, marginBottom: "0.375rem" }}>
                  {cat.label}
                </div>
                <div style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.6)" }}>{cat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section style={{ padding: "6rem 1.5rem", textAlign: "center" }}>
        <div className="glow-border" style={{
          maxWidth: 700, margin: "0 auto",
          background: "rgba(15,12,41,0.95)",
          borderRadius: "1.5rem", padding: "3rem 2rem",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛡️</div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>
            Ready to find <span className="gradient-text">your path forward</span>?
          </h2>
          <p style={{ color: "rgba(241,245,249,0.7)", marginBottom: "2rem", lineHeight: 1.8 }}>
            Describe your financial situation in Tamil or English. VazhiAPI will analyse your stress,
            identify the debt type, and connect you to the right government scheme or legal aid — in seconds.
          </p>
          <Link href="/register">
            <button className="btn-primary" style={{ fontSize: "1.05rem", padding: "1rem 2.5rem" }}>
              Start Free — வழி தொடங்கு →
            </button>
          </Link>
        </div>
      </section>
    </main>
  );
}
