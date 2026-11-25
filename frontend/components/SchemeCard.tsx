"use client";
import type { GovernmentScheme } from "@/types";
import { useLang } from "@/lib/i18n";

const TYPE_COLORS: Record<string, string> = {
  "Direct Benefit Transfer": "#10b981",
  "Low-Interest Credit": "#3b82f6",
  "Micro Credit": "#a855f7",
  "Micro Enterprise Loan": "#a855f7",
  "Free Legal Aid": "#f59e0b",
  "Complaint / Regulatory Redressal": "#ef4444",
  "Health Insurance": "#f43f5e",
  Insurance: "#06b6d4",
  Subsidy: "#22c55e",
};

export default function SchemeCard({ scheme, expanded = false }: { scheme: GovernmentScheme; expanded?: boolean }) {
  const { lang } = useLang();
  const typeColor = TYPE_COLORS[scheme.type] || "#f59e0b";
  return (
    <div className="glass-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.2rem", lineHeight: 1.3 }}>
            {lang === "ta" ? scheme.name_ta : scheme.name}
          </div>
          <div className="font-tamil" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {lang === "ta" ? scheme.name : scheme.name_ta}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem", flexShrink: 0 }}>
          <span className="badge" style={{ background: `${typeColor}22`, color: typeColor, border: `1px solid ${typeColor}44` }}>{scheme.type}</span>
          {scheme.level && <span style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase" }}>{scheme.level === "state" ? "Tamil Nadu" : "Central"}</span>}
        </div>
      </div>

      {typeof scheme.match_score === "number" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
            <span style={{ color: "var(--muted)" }}>Match</span><span style={{ color: "#34d399", fontWeight: 700 }}>{scheme.match_score}%</span>
          </div>
          <div className="bar"><div style={{ width: `${scheme.match_score}%`, background: "linear-gradient(90deg,#10b981,#34d399)" }} /></div>
          {!!scheme.match_reasons?.length && (
            <div style={{ fontSize: "0.75rem", color: "#a7f3d0", marginTop: "0.35rem" }}>✓ {scheme.match_reasons.join(" · ")}</div>
          )}
        </div>
      )}

      <div className="benefit-box">
        <div className="benefit-label">Benefit</div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{scheme.benefit}</div>
      </div>

      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>🏛️ {scheme.authority}</div>
      <p className={lang === "ta" ? "font-tamil" : ""} style={{ fontSize: "0.875rem", color: "var(--text-2)", lineHeight: 1.6 }}>
        {lang === "ta" ? scheme.description_ta : scheme.description}
      </p>

      {expanded && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Eligibility</div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {scheme.eligibility.map((e, i) => (
              <li key={i} style={{ fontSize: "0.8rem", color: "var(--text-2)", display: "flex", gap: "0.5rem" }}>
                <span style={{ color: "#34d399" }}>✓</span> {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginTop: "auto" }}>
        <a href={scheme.application_url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">Official site →</a>
        <a href={`tel:${scheme.helpline}`} style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>📞 {scheme.helpline}</a>
      </div>
    </div>
  );
}
