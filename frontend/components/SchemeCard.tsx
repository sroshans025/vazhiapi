"use client";
import { Building2, Check, ExternalLink, Phone } from "lucide-react";
import type { GovernmentScheme } from "@/types";
import { useLang } from "@/lib/i18n";

const TYPE_COLORS: Record<string, string> = {
  "Direct Benefit Transfer": "#15803d",
  "Low-Interest Credit": "#0f6e5c",
  "Micro Credit": "#7e22ce",
  "Micro Enterprise Loan": "#7e22ce",
  "Free Legal Aid": "#b45309",
  "Complaint / Regulatory Redressal": "#b91c1c",
  "Health Insurance": "#be123c",
  Insurance: "#0369a1",
  Subsidy: "#15803d",
};

export default function SchemeCard({ scheme, expanded = false }: { scheme: GovernmentScheme; expanded?: boolean }) {
  const { lang } = useLang();
  const c = TYPE_COLORS[scheme.type] || "#57534e";
  return (
    <div className="card" style={{ padding: "1.35rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "1.02rem", marginBottom: "0.15rem", lineHeight: 1.35 }}>{lang === "ta" ? scheme.name_ta : scheme.name}</div>
          <div className="font-tamil muted" style={{ fontSize: "0.82rem" }}>{lang === "ta" ? scheme.name : scheme.name_ta}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem", flexShrink: 0 }}>
          <span className="badge" style={{ background: `${c}12`, color: c, borderColor: `${c}33` }}>{scheme.type}</span>
          {scheme.level && <span className="muted" style={{ fontSize: "0.72rem" }}>{scheme.level === "state" ? "Tamil Nadu" : "Central"}</span>}
        </div>
      </div>

      {typeof scheme.match_score === "number" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
            <span className="muted">Match</span><span style={{ color: "var(--success)", fontWeight: 700 }}>{scheme.match_score}%</span>
          </div>
          <div className="bar"><div style={{ width: `${scheme.match_score}%`, background: "var(--success)" }} /></div>
          {!!scheme.match_reasons?.length && <div style={{ fontSize: "0.78rem", color: "var(--success)", marginTop: "0.35rem" }}>{scheme.match_reasons.join(" · ")}</div>}
        </div>
      )}

      <div className="benefit-box">
        <div className="benefit-label">Benefit</div>
        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{scheme.benefit}</div>
      </div>

      <div className="muted" style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}><Building2 size={14} /> {scheme.authority}</div>
      <p className={lang === "ta" ? "font-tamil" : ""} style={{ fontSize: "0.9rem", color: "var(--text-2)", lineHeight: 1.6 }}>
        {lang === "ta" ? scheme.description_ta : scheme.description}
      </p>

      {expanded && (
        <div>
          <div className="panel-label">Eligibility</div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {scheme.eligibility.map((e, i) => (
              <li key={i} style={{ fontSize: "0.86rem", color: "var(--text-2)", display: "flex", gap: "0.45rem" }}>
                <Check size={15} color="var(--success)" className="icon" style={{ marginTop: 3 }} /> {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center", marginTop: "auto" }}>
        <a href={scheme.application_url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">Official site <ExternalLink size={14} /></a>
        <a href={`tel:${scheme.helpline}`} style={{ fontSize: "0.86rem", display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--text-2)" }}><Phone size={14} /> {scheme.helpline}</a>
      </div>
    </div>
  );
}
