import type { GovernmentScheme } from "@/types";

interface SchemeCardProps {
  scheme: GovernmentScheme;
  expanded?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  "Direct Benefit Transfer": "#10b981",
  "Zero-Interest Credit": "#3b82f6",
  "Micro Credit": "#a855f7",
  "Micro Enterprise Loan": "#a855f7",
  "Free Legal Aid": "#f59e0b",
  "Complaint / Regulatory Redressal": "#ef4444",
  "Loan Waiver": "#22c55e",
};

export default function SchemeCard({ scheme, expanded = false }: SchemeCardProps) {
  const typeColor = TYPE_COLORS[scheme.type] || "#f59e0b";

  return (
    <div className="glass-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.2rem", lineHeight: 1.3 }}>
            {scheme.name}
          </div>
          <div style={{ fontFamily: "'Noto Sans Tamil', sans-serif", fontSize: "0.8rem", color: "rgba(241,245,249,0.5)" }}>
            {scheme.name_ta}
          </div>
        </div>
        <span className="badge" style={{ background: `${typeColor}22`, color: typeColor, border: `1px solid ${typeColor}44`, whiteSpace: "nowrap", flexShrink: 0 }}>
          {scheme.type}
        </span>
      </div>

      {/* Benefit */}
      <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "0.5rem", padding: "0.625rem 0.875rem" }}>
        <div style={{ fontSize: "0.7rem", color: "#34d399", marginBottom: "0.125rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Benefit</div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f1f5f9" }}>{scheme.benefit}</div>
      </div>

      {/* Authority */}
      <div style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.5)" }}>
        🏛️ {scheme.authority}
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.875rem", color: "rgba(241,245,249,0.7)", lineHeight: 1.6 }}>
        {scheme.description}
      </p>

      {/* Eligibility (expanded only) */}
      {expanded && (
        <div>
          <div style={{ fontSize: "0.75rem", color: "rgba(241,245,249,0.4)", marginBottom: "0.5rem", textTransform: "uppercase" }}>Eligibility</div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {scheme.eligibility.map((e, i) => (
              <li key={i} style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.7)", display: "flex", gap: "0.5rem" }}>
                <span style={{ color: "#34d399" }}>✓</span> {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
        <a href={scheme.application_url} target="_blank" rel="noopener noreferrer">
          <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }}>
            Apply →
          </button>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "rgba(241,245,249,0.5)" }}>
          📞 {scheme.helpline}
        </div>
      </div>
    </div>
  );
}
