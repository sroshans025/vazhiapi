"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PageHero from "@/components/PageHero";
import SchemeCard from "@/components/SchemeCard";
import { apiMatchSchemes, apiSchemes, errorMessage } from "@/lib/api";
import { CATEGORY_META } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import type { GovernmentScheme } from "@/types";

const OCCUPATIONS = [
  ["farmer", "🌾 Farmer"], ["vendor", "🛒 Street vendor"], ["self_employed", "🧰 Small business"], ["daily_wage", "👷 Daily-wage worker"],
  ["salaried", "💼 Salaried"], ["student", "🎓 Student"], ["homemaker", "🏠 Homemaker"], ["unemployed", "🔎 Looking for work"],
];

function Finder() {
  const [p, setP] = useState<{ gender?: string; age?: number; annual_income?: number; occupation?: string; community?: string; debt_category?: string }>({});
  const [res, setRes] = useState<GovernmentScheme[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setP((x) => ({ ...x, [k]: v === "" || Number.isNaN(v) ? undefined : v }));
  const go = async () => {
    setLoading(true); setErr("");
    try { setRes((await apiMatchSchemes(p)).schemes); } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  };
  return (
    <div className="glass-card card-pad" style={{ marginBottom: "2rem", borderColor: "rgba(245,158,11,0.3)" }}>
      <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.25rem" }}>🔎 Scheme Finder</div>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>Answer what you&apos;re comfortable with. Nothing here is saved.</p>
      <div className="grid-3" style={{ gap: "1rem" }}>
        <div><label className="label">Gender</label>
          <select className="input-field" value={p.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Prefer not to say</option><option value="female">Woman</option><option value="male">Man</option><option value="other">Other</option>
          </select></div>
        <div><label className="label">Age</label><input className="input-field" type="number" min={10} max={110} value={p.age ?? ""} onChange={(e) => set("age", parseInt(e.target.value))} /></div>
        <div><label className="label">Family income per year (₹)</label><input className="input-field" type="number" min={0} step={10000} value={p.annual_income ?? ""} onChange={(e) => set("annual_income", parseFloat(e.target.value))} /></div>
        <div><label className="label">Community</label>
          <select className="input-field" value={p.community ?? ""} onChange={(e) => set("community", e.target.value)}>
            <option value="">Prefer not to say</option><option value="general">General</option><option value="obc">BC / MBC / OBC</option><option value="sc">SC</option><option value="st">ST</option>
          </select></div>
        <div><label className="label">Main debt worry</label>
          <select className="input-field" value={p.debt_category ?? ""} onChange={(e) => set("debt_category", e.target.value)}>
            <option value="">Any</option>{Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select></div>
      </div>
      <label className="label" style={{ marginTop: "1rem" }}>Work</label>
      <div className="tabs">{OCCUPATIONS.map(([k, l]) => <button key={k} className={`chip ${p.occupation === k ? "active" : ""}`} onClick={() => set("occupation", p.occupation === k ? "" : k)}>{l}</button>)}</div>
      <button className="btn-primary" onClick={go} disabled={loading}>{loading ? "Matching…" : "Find my schemes →"}</button>
      {err && <div className="error-box" style={{ marginTop: "1rem" }}>{err}</div>}
      {res && (
        <div style={{ marginTop: "1.5rem" }}>
          <div className="panel-label">{res.length} schemes ranked for you</div>
          <div className="grid-2">{res.slice(0, 6).map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
        </div>
      )}
    </div>
  );
}

export default function SchemesPage() {
  const { lang } = useLang();
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [total, setTotal] = useState(0);
  const [cat, setCat] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [finder, setFinder] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true);
      apiSchemes({ category: cat || undefined, level: level || undefined, q: q.trim() || undefined })
        .then((d) => { setSchemes(d.schemes); setTotal(d.total); setErr(""); })
        .catch((e) => setErr(errorMessage(e, "Couldn't load schemes.")))
        .finally(() => setLoading(false));
    }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [cat, level, q]);

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <PageHero eyebrow={`${total || 24} schemes · Tamil Nadu + Central`} title={<span className="gradient-text">{lang === "ta" ? "அரசு திட்டங்கள்" : "Government schemes that can help"}</span>}
            subtitle="Zero-interest SHG credit, direct benefits, free legal aid, insurance and complaint channels, filtered by your debt situation.">
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
              <button className="btn-primary" onClick={() => setFinder((f) => !f)}>{finder ? "Hide" : "🔎 Find schemes for me"}</button>
            </div>
          </PageHero>

          {finder && <Finder />}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input className="input-field" style={{ maxWidth: 340 }} placeholder="Search schemes… e.g. loan, women, farmer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search schemes" />
            <div className="tabs" style={{ marginBottom: 0 }}>
              {[["", "All"], ["state", "Tamil Nadu"], ["central", "Central"]].map(([k, l]) => <button key={k} className={`chip ${level === k ? "active" : ""}`} onClick={() => setLevel(k)}>{l}</button>)}
            </div>
          </div>
          <div className="tabs">
            <button className={`chip ${!cat ? "active" : ""}`} onClick={() => setCat("")}>All debt types</button>
            {Object.entries(CATEGORY_META).map(([k, v]) => <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{v.icon} {lang === "ta" ? v.label_ta : v.label}</button>)}
          </div>

          {err && <div className="error-box">{err}</div>}
          {loading ? <div className="spinner" style={{ margin: "3rem auto" }} /> : (
            schemes.length ? <div className="grid-2">{schemes.map((s) => <SchemeCard key={s.id} scheme={s} expanded />)}</div>
              : !err && <div className="muted" style={{ textAlign: "center", padding: "3rem" }}>No schemes match. Try a different filter.</div>
          )}
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: "1.5rem" }}>Benefits and eligibility change with government orders; confirm on the official portal or helpline before applying.</p>
        </div>
      </div>
    </>
  );
}
