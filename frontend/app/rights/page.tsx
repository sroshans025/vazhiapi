"use client";
import { Building2, HeartPulse, Landmark, Phone, Scale, Siren, Stethoscope, type LucideIcon } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PageHero from "@/components/PageHero";
import { apiHelplines, apiLaws, errorMessage } from "@/lib/api";
import { CATEGORY_META } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import type { Helpline, Law } from "@/types";

const KIND_ICON: Record<string, LucideIcon> = { emergency: Siren, mental_health: HeartPulse, legal: Scale, financial: Landmark, health: Stethoscope, government: Building2 };

export default function RightsPage() {
  const { lang } = useLang();
  const [laws, setLaws] = useState<Law[]>([]);
  const [helplines, setHelplines] = useState<Helpline[]>([]);
  const [open, setOpen] = useState<string | null>("tn_exorbitant_interest_2003");
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([apiLaws(), apiHelplines()])
      .then(([l, h]) => { setLaws(l.laws); setHelplines(h.helplines); })
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  const shown = filter ? laws.filter((l) => l.categories.includes(filter)) : laws;

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <PageHero eyebrow={lang === "ta" ? "உங்கள் உரிமைகள்" : "Know your rights"}
            title={<><span className="gradient-text">{lang === "ta" ? "சட்டம் உங்கள் பக்கம்" : "The law is on your side"}</span></>}
            subtitle={lang === "ta" ? "கந்து வட்டி, மிரட்டும் வசூல், கடன் செயலி தொல்லை — இவை குற்றங்கள். உங்கள் உரிமைகளும் இலவச உதவி எண்களும்." : "Exorbitant interest, abusive recovery agents and loan-app threats are illegal. Here are your rights in plain language, and free numbers to call."} />

          {err && <div className="error-box">{err}</div>}

          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}><Phone size={18} className="icon" color="var(--primary)" /> {lang === "ta" ? "இலவச உதவி எண்கள்" : "Free helplines"}</h2>
          <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
            {helplines.map((h) => (
              <a key={h.id} href={`tel:${h.number}`} className="glass-card" style={{ padding: "1rem 1.1rem", textDecoration: "none", color: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }} className={lang === "ta" ? "font-tamil" : ""}>{(() => { const I = KIND_ICON[h.kind] ?? Phone; return <I size={15} className="icon" color="var(--primary)" />; })()} {lang === "ta" ? h.name_ta : h.name}</div>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>{h.hours}</div>
                </div>
                <span className="sos-num">{h.number}</span>
              </a>
            ))}
          </div>

          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}><Scale size={18} className="icon" color="var(--primary)" /> {lang === "ta" ? "சட்டங்கள்" : "Laws that protect you"}</h2>
          <div className="tabs">
            <button className={`chip ${!filter ? "active" : ""}`} onClick={() => setFilter("")}>All</button>
            {Object.entries(CATEGORY_META).filter(([k]) => laws.some((l) => l.categories.includes(k))).map(([k, v]) => (
              <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}><CategoryIcon id={k} size={14} /> {lang === "ta" ? v.label_ta : v.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {shown.map((l) => (
              <div key={l.id} className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <button onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "inherit", padding: "1rem 1.25rem", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: "1rem", fontFamily: "inherit" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{lang === "ta" ? l.name_ta : l.name}</div>
                    <div className="muted font-tamil" style={{ fontSize: "0.78rem" }}>{lang === "ta" ? l.name : l.name_ta}</div>
                  </div>
                  <span style={{ color: "var(--primary)", fontSize: "1.2rem" }}>{open === l.id ? "−" : "+"}</span>
                </button>
                {open === l.id && (
                  <div style={{ padding: "0 1.25rem 1.25rem", animation: "pop 0.2s ease" }}>
                    <p className={lang === "ta" ? "font-tamil" : ""} style={{ color: "var(--text-2)", lineHeight: 1.7, marginBottom: "0.75rem" }}>{lang === "ta" ? l.summary_ta : l.summary}</p>
                    <div className="panel-label">Your rights</div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
                      {l.your_rights.map((r) => <li key={r} style={{ fontSize: "0.88rem" }}><span style={{ color: "var(--success)" }}>✓</span> {r}</li>)}
                    </ul>
                    <div className="benefit-box" style={{ fontSize: "0.86rem" }}>{l.how_to_act}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: "1.5rem" }}>General information, not legal advice for your case. For free advice, contact your District Legal Services Authority (15100).</p>
        </div>
      </div>
    </>
  );
}
