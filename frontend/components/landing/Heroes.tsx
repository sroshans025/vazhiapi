"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Landmark, Languages, Lock, MessageCircle, Scale, ShieldCheck, Sparkles } from "lucide-react";
import StressGauge from "@/components/StressGauge";
import Markdown from "@/components/Markdown";
import CategoryIcon from "@/components/CategoryIcon";
import { apiDemoAnalyse, errorMessage } from "@/lib/api";
import * as offline from "@/lib/offline";
import { ACTION_ICONS, CATEGORY_META, fmtINR } from "@/lib/constants";
import { PHOTOS, type PhotoKey } from "@/lib/photos";
import { useLang } from "@/lib/i18n";
import type { AnalysisSummary, DebtCategory, GovernmentScheme } from "@/types";

/* ── helpers ─────────────────────────────────────────────── */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("in");
    if (typeof IntersectionObserver === "undefined") { show(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { show(); io.disconnect(); } }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    const safety = setTimeout(show, 2500);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);
  return ref;
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false, raf = 0;
    const run = () => {
      if (started) return;
      started = true;
      const start = performance.now();
      const tick = (t: number) => { const p = Math.min((t - start) / 1000, 1); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    const io = typeof IntersectionObserver === "undefined" ? null
      : new IntersectionObserver(([e]) => { if (e.isIntersecting) { io?.disconnect(); run(); } }, { threshold: 0 });
    io?.observe(el);
    const safety = setTimeout(run, io ? 3000 : 0);
    return () => { io?.disconnect(); clearTimeout(safety); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{v}</span>;
}

function Photo({ k, style, priority = false, sizes = "(max-width: 980px) 100vw, 50vw" }: { k: PhotoKey; style?: React.CSSProperties; priority?: boolean; sizes?: string }) {
  const p = PHOTOS[k];
  return (
    <figure className="photo" style={style}>
      <Image src={p.src} alt={p.alt} width={p.w} height={p.h} priority={priority} sizes={sizes} />
      <figcaption>{p.caption} · {p.author}, {p.license}</figcaption>
    </figure>
  );
}

const SectionHead = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) => (
  <div style={{ maxWidth: 680, marginBottom: "2.25rem" }}>
    <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>{eyebrow}</div>
    <h2 className="section-title">{title}</h2>
    {sub && <p style={{ color: "var(--text-2)", fontSize: "1.02rem" }}>{sub}</p>}
  </div>
);

/* ── 1. Hero ─────────────────────────────────────────────── */
export function HeroIntro() {
  const { lang } = useLang();
  const ta = lang === "ta";
  return (
    <section style={{ padding: "6.5rem 1.25rem 4rem" }}>
      <div className="hero-grid">
        <div>
          <div className="eyebrow" style={{ marginBottom: "1rem" }}>{ta ? "தமிழ்நாட்டுக்கான இலவச நிதி நல உதவி" : "Free financial wellness help for Tamil Nadu"}</div>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1rem" }}>
            {ta ? "கடனில் இருந்து வெளியே வர " : "Find your way out of debt. "}
            <span className="font-tamil" style={{ color: "var(--accent)", fontSize: "0.82em" }}>வழி இருக்கிறது.</span>
          </h1>
          <p style={{ fontSize: "1.12rem", color: "var(--text-2)", lineHeight: 1.7, maxWidth: 560, marginBottom: "1.75rem" }}>
            {ta
              ? "கந்து வட்டி, சீட்டு, நகைக் கடன், கடன் செயலி மிரட்டல் — உங்கள் வார்த்தைகளில் சொல்லுங்கள். உங்கள் உரிமைகள், பொருந்தும் அரசு திட்டங்கள், அடுத்த படி — எல்லாம் ஒரே இடத்தில்."
              : "Talk about kandhu vatti, a chit fund that collapsed, a gold loan auction notice or a harassing loan app, in Tamil, English or Tanglish. Get your legal rights, the government schemes you qualify for, and a clear next step."}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <Link href="/register" className="btn-primary" style={{ padding: "0.85rem 1.5rem" }}>{ta ? "இலவசமாக தொடங்குங்கள்" : "Start a free check-in"} <ArrowRight size={18} /></Link>
            <a href="#demo" className="btn-ghost" style={{ padding: "0.85rem 1.5rem" }}>{ta ? "முயற்சி செய்து பாருங்கள்" : "Try it without signing up"}</a>
          </div>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.88rem", color: "var(--muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}><Lock size={15} /> {ta ? "ரகசியம்" : "Confidential"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}><Languages size={15} /> {ta ? "தமிழ் · English" : "Tamil · English · Tanglish"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}><ShieldCheck size={15} /> {ta ? "யாரும் குறை சொல்ல மாட்டார்கள்" : "No judgement"}</span>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <Photo k="shgMeeting" priority style={{ aspectRatio: "4 / 3.2", boxShadow: "var(--shadow)" }} />
          <div className="card" style={{ position: "absolute", left: "-1rem", bottom: "-1.5rem", padding: "0.85rem 1rem", maxWidth: 270, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
              <span className="icon-tile" style={{ background: "var(--accent-soft)", width: 34, height: 34 }}><Landmark size={17} color="var(--accent)" /></span>
              <div style={{ fontSize: "0.84rem", lineHeight: 1.45 }}>
                <b>{ta ? "24 அரசு திட்டங்கள்" : "24 government schemes"}</b><br />
                <span className="muted">{ta ? "SHG கடன், இலவச சட்ட உதவி, நேரடி உதவி" : "SHG credit, free legal aid, direct benefits"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 2. Live demo ────────────────────────────────────────── */
const SAMPLES = [
  { label: "Kandhu vatti", text: "I borrowed ₹50,000 from a moneylender at 10% every week and the collector comes daily. I can't sleep." },
  { label: "Loan app", text: "An instant loan app is calling my contacts and threatening to send morphed photos" },
  { label: "Gold loan (Tamil)", text: "நகைக் கடன் தவணை தாண்டிவிட்டது, அடுத்த வாரம் ஏலம் என்று நோட்டீஸ் வந்தது" },
  { label: "Farm (Tanglish)", text: "mazhai illama nel payir pochu, crop loan katta mudiyala, romba tension ah irukku" },
  { label: "Education loan", text: "My education loan EMI started but I still don't have a job" },
];

export function LiveDemo() {
  const ref = useReveal<HTMLElement>();
  const { lang } = useLang();
  const [text, setText] = useState(SAMPLES[0].text);
  const [res, setRes] = useState<(AnalysisSummary & { offline?: boolean }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const run = (t: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!t.trim()) { setRes(null); return; }
    timer.current = setTimeout(async () => {
      const my = ++seq.current;
      setLoading(true); setErr("");
      try { const r = await apiDemoAnalyse(t); if (my === seq.current) setRes(r); }
      catch (e) { if (my === seq.current) setErr(errorMessage(e, "Demo unavailable right now.")); }
      finally { if (my === seq.current) setLoading(false); }
    }, 500);
  };
  useEffect(() => {
    const id = setTimeout(() => run(SAMPLES[0].text), 0);
    return () => { clearTimeout(id); if (timer.current) clearTimeout(timer.current); };
     
  }, []);

  const meta = res ? CATEGORY_META[res.debt_category] : null;
  const ActionIcon = res ? ACTION_ICONS[res.rl_action] : null;
  return (
    <section id="demo" ref={ref} className="reveal section-alt" style={{ padding: "4.5rem 1.25rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <SectionHead eyebrow="Try it now · no sign-up" title="Describe a money worry in your own words"
          sub="Pick an example or type your own. Vazhi reads the stress level, identifies the kind of debt trap, and suggests what to do first." />
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="card card-pad">
            <label className="label" htmlFor="demo-text">Your situation</label>
            <textarea id="demo-text" className="input-field" style={{ minHeight: 120 }} value={text} maxLength={600}
              onChange={(e) => { setText(e.target.value); run(e.target.value); }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.85rem" }}>
              {SAMPLES.map((s) => (
                <button key={s.label} className={`chip ${text === s.text ? "active" : ""}`} onClick={() => { setText(s.text); run(s.text); }}>{s.label}</button>
              ))}
            </div>
            {err && <div className="error-box" style={{ marginTop: "0.9rem" }}>{err}</div>}
          </div>

          <div className="card card-pad" style={{ minHeight: 260 }}>
            {!res && loading && <div className="spinner" style={{ margin: "4rem auto" }} />}
            {res && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1.1rem", alignItems: "center" }}>
                  <StressGauge score={res.stress_score} label={res.stress_label} size={116} caption="" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, color: meta?.color }}>
                      <CategoryIcon id={res.debt_category} size={18} tile /> {lang === "ta" ? res.debt_category_label_ta : res.debt_category_label}
                    </span>
                    {ActionIcon && <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", fontSize: "0.92rem" }}><ActionIcon size={16} color="var(--primary)" /> {res.rl_action_label}</span>}
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      {res.language === "ta" ? "Tamil" : res.language === "tanglish" ? "Tanglish" : "English"} detected
                      {res.crisis.level !== "low" && <span style={{ color: "var(--danger)" }}> · {res.crisis.level === "severe" ? "harassment flagged" : res.crisis.level === "critical" ? "urgent: please call 14416" : "high pressure"}</span>}
                    </span>
                  </div>
                </div>
                {res.refined_response && (
                  <div className="fade-out" style={{ marginTop: "1rem", maxHeight: 180, overflow: "hidden", fontSize: "0.92rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                    <Markdown text={res.refined_response.split("\n\n").slice(0, 2).join("\n\n")} />
                  </div>
                )}
                <Link href="/register" className="btn-primary btn-sm" style={{ marginTop: "0.75rem" }}>Continue in a private chat <ArrowRight size={15} /></Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3. Interest calculator ──────────────────────────────── */
export function TrapCalculator() {
  const ref = useReveal<HTMLElement>();
  const [principal, setPrincipal] = useState(50000);
  const [rate, setRate] = useState(10);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [months, setMonths] = useState(6);
  const n = { day: 365, week: 52, month: 12 }[period];
  const apr = rate * n;
  const informal = principal + principal * (rate / 100) * ((months * n) / 12);
  const shg = principal * (1 + 0.1 * (months / 12));

  return (
    <section id="calculator" ref={ref} className="reveal" style={{ padding: "4.5rem 1.25rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <SectionHead eyebrow="Interest calculator" title="How much is that “small” interest really costing you?"
          sub="Moneylenders quote interest per week or per day so it sounds small. Move the sliders to see the yearly rate." />
        <div className="grid-2" style={{ alignItems: "stretch" }}>
          <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1.3rem" }}>
            <div>
              <label className="label">Amount borrowed: <b style={{ color: "var(--text)" }}>{fmtINR(principal)}</b></label>
              <input type="range" min={5000} max={300000} step={5000} value={principal} onChange={(e) => setPrincipal(+e.target.value)} />
            </div>
            <div>
              <label className="label">Interest: <b style={{ color: "var(--text)" }}>{rate}% per {period}</b></label>
              <input type="range" min={0.5} max={period === "day" ? 10 : 30} step={0.5} value={rate} onChange={(e) => setRate(+e.target.value)} />
              <div className="tabs" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
                {(["day", "week", "month"] as const).map((p) => (
                  <button key={p} className={`chip ${period === p ? "active" : ""}`} onClick={() => { setPeriod(p); if (p === "day") setRate(Math.min(rate, 10)); }}>per {p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Time to repay: <b style={{ color: "var(--text)" }}>{months} months</b></label>
              <input type="range" min={1} max={24} value={months} onChange={(e) => setMonths(+e.target.value)} />
            </div>
          </div>
          <div className="card card-pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.1rem" }}>
            <div>
              <div className="muted" style={{ fontSize: "0.85rem" }}>Yearly interest rate</div>
              <div className="big-num" style={{ color: apr > 36 ? "var(--danger)" : "var(--success)" }}>{apr.toLocaleString("en-IN")}%</div>
              {apr > 36 && <div style={{ color: "var(--danger)", fontSize: "0.86rem", marginTop: "0.4rem", display: "flex", gap: "0.4rem" }}><Scale size={16} className="icon" /> Likely illegal under the TN Prohibition of Charging Exorbitant Interest Act, 2003</div>}
            </div>
            <div className="grid-2" style={{ gap: "0.75rem" }}>
              <div style={{ padding: "0.9rem", borderRadius: 10, background: "var(--danger-soft)", border: "1px solid #f5c2c2" }}>
                <div className="muted" style={{ fontSize: "0.78rem" }}>You repay the moneylender</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--danger)" }}>{fmtINR(informal)}</div>
              </div>
              <div style={{ padding: "0.9rem", borderRadius: 10, background: "var(--success-soft)", border: "1px solid #bfe3cb" }}>
                <div className="muted" style={{ fontSize: "0.78rem" }}>Same loan from an SHG (~10%/yr)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--success)" }}>{fmtINR(shg)}</div>
              </div>
            </div>
            <div style={{ fontSize: "0.95rem", color: "var(--text-2)" }}>
              That&apos;s <b style={{ color: "var(--text)" }}>{(informal / shg).toFixed(1)}×</b> more, an extra <b style={{ color: "var(--text)" }}>{fmtINR(informal - shg)}</b>. <Link href="/tools">More calculators</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 4. Real situations (photos) ─────────────────────────── */
const STORIES: { k: PhotoKey; cat: string; title: string; body: string }[] = [
  { k: "vendor", cat: "blade_finance", title: "Daily vatti for street vendors", body: "Borrowing ₹10,000 in the morning to buy stock and paying it back with interest by evening adds up to hundreds of percent a year. PM SVANidhi and SHG loans cost a fraction of that." },
  { k: "farmer", cat: "agricultural_debt", title: "Crop loans after a bad monsoon", body: "When the rains fail, Kisan Credit Card restructuring, crop insurance claims and PM-KISAN can keep farmers away from private moneylenders." },
  { k: "shgStall", cat: "microfinance_debt", title: "Women's groups as the way out", body: "Self-help groups save together and get collateral-free bank loans at low interest, one of the most reliable ways out of the moneylender cycle." },
];

export function Stories() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal section-alt" style={{ padding: "4.5rem 1.25rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <SectionHead eyebrow="Built for Tamil Nadu" title="The debts people here actually face"
          sub="Generic finance apps don't understand kandhu vatti, chit funds or jewel loans. Vazhi does." />
        <div className="grid-3">
          {STORIES.map((s) => (
            <article key={s.k} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <Photo k={s.k} sizes="(max-width: 768px) 100vw, 33vw" style={{ aspectRatio: "4 / 3", borderRadius: 0 }} />
              <div style={{ padding: "1.15rem 1.25rem 1.35rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <CategoryIcon id={s.cat} size={16} tile />
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>{s.title}</h3>
                </div>
                <p style={{ color: "var(--text-2)", fontSize: "0.93rem", lineHeight: 1.65 }}>{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 5. Debt-trap explorer ───────────────────────────────── */
export function CategoryExplorer() {
  const ref = useReveal<HTMLElement>();
  const { lang } = useLang();
  const cats = offline.kb.categories as DebtCategory[];
  const [sel, setSel] = useState("blade_finance");
  const cur = cats.find((c) => c.id === sel);
  const m = CATEGORY_META[sel];

  return (
    <section ref={ref} className="reveal" style={{ padding: "4.5rem 1.25rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <SectionHead eyebrow="12 debt traps" title="Choose a situation to see the way out"
          sub="Each comes with first steps you can take this week and the law that protects you." />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: "1.5rem" }} className="explorer">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.65rem", alignContent: "start" }}>
            {cats.map((c) => (
              <button key={c.id} className={`cat-tile ${sel === c.id ? "sel" : ""}`} onClick={() => setSel(c.id)} aria-pressed={sel === c.id}>
                <CategoryIcon id={c.id} size={18} tile />
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{lang === "ta" ? CATEGORY_META[c.id].label_ta : CATEGORY_META[c.id].label}</span>
              </button>
            ))}
          </div>
          {cur && (
            <div className="card card-pad" key={sel} style={{ animation: "pop 0.2s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.75rem" }}>
                <CategoryIcon id={sel} size={22} tile />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.15rem", color: m.color }}>{lang === "ta" ? cur.label_ta : cur.label}</div>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>Risk: {cur.risk_level} · Typical amount: {cur.typical_amounts}</div>
                </div>
              </div>
              <p className={lang === "ta" ? "font-tamil" : ""} style={{ color: "var(--text-2)", fontSize: "0.94rem", lineHeight: 1.7, marginBottom: "1rem" }}>
                {lang === "ta" ? cur.description_ta : cur.description}
              </p>
              <div className="panel-label">First steps</div>
              <ol style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.92rem", marginBottom: "1rem" }}>
                {(lang === "ta" ? cur.first_steps_ta : cur.first_steps).slice(0, 4).map((s) => <li key={s}>{s}</li>)}
              </ol>
              {cur.legal_status !== "—" && (
                <div className="benefit-box" style={{ fontSize: "0.88rem", display: "flex", gap: "0.5rem" }}><Scale size={16} className="icon" color="var(--primary)" /> {cur.legal_status}</div>
              )}
              <Link href="/register" className="btn-primary btn-sm" style={{ marginTop: "1rem" }}>Get a personal plan <ArrowRight size={15} /></Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── 6. How it works ─────────────────────────────────────── */
const STEPS = [
  { t: "Tell us what's happening", d: "Write or speak in Tamil, English or Tanglish. There's no form to fill.", Icon: MessageCircle },
  { t: "We understand the situation", d: "Six AI layers score stress, identify the debt trap, and track whether things are getting better or worse.", Icon: Sparkles },
  { t: "Know your rights", d: "Plain-language explanations of the laws that protect you from illegal interest and harassment.", Icon: Scale },
  { t: "Get matched to help", d: "Government schemes, free legal aid and helplines that fit your situation, with numbers to call.", Icon: Landmark },
];

export function HowItWorks() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal section-alt" style={{ padding: "4.5rem 1.25rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <SectionHead eyebrow="How it works" title="From worry to a plan in a few minutes" />
        <div className="grid-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card" style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                <span className="icon-tile" style={{ background: "var(--accent-soft)" }}><s.Icon size={18} color="var(--accent)" /></span>
                <span className="muted" style={{ fontWeight: 700, fontSize: "0.85rem" }}>Step {i + 1}</span>
              </div>
              <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>{s.t}</div>
              <div style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.6 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 7. Numbers, schemes, call to action ─────────────────── */
export function SchemesAndCTA() {
  const ref = useReveal<HTMLElement>();
  const { lang } = useLang();
  const schemes = offline.kb.schemes as GovernmentScheme[];
  const loop = useMemo(() => [...schemes, ...schemes], [schemes]);
  return (
    <section ref={ref} className="reveal" style={{ padding: "4.5rem 0 4rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto 2.5rem", padding: "0 1.25rem" }} className="grid-4">
        {[{ n: 24, l: "Government schemes" }, { n: 12, l: "Debt traps recognised" }, { n: 14, l: "Laws explained simply" }, { n: 38, l: "Districts covered" }].map((x) => (
          <div key={x.l} className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
            <div className="stat-num" style={{ color: "var(--accent)" }}><CountUp to={x.n} /></div>
            <div className="muted" style={{ fontSize: "0.86rem" }}>{x.l}</div>
          </div>
        ))}
      </div>
      <div className="marquee-wrap" style={{ marginBottom: "3.5rem" }}>
        <div className="marquee">
          {loop.map((s, i) => (
            <Link key={`${s.id}-${i}`} href="/schemes" className="chip" style={{ whiteSpace: "nowrap", padding: "0.55rem 0.95rem" }}>
              <Landmark size={14} /> {lang === "ta" ? s.name_ta : s.name}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 1.25rem" }}>
        <div className="card cta-split" style={{ maxWidth: 1180, margin: "0 auto", overflow: "hidden" }}>
          <div style={{ padding: "2.5rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 className="section-title">{lang === "ta" ? "இன்றே முதல் படி எடுங்கள்" : "Take the first step today"}</h2>
            <p style={{ color: "var(--text-2)", marginBottom: "1.5rem", lineHeight: 1.75 }}>
              A confidential chat that understands kandhu vatti, chit funds and loan-app harassment, and knows the Tamil Nadu schemes and laws that can help.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/register" className="btn-primary"><span>Start free · <span className="font-tamil">வழி தொடங்கு</span></span> <ArrowRight size={17} /></Link>
              <Link href="/rights" className="btn-ghost">Know your rights</Link>
            </div>
          </div>
          <Photo k="shgStall" sizes="(max-width: 768px) 100vw, 50vw" style={{ borderRadius: 0, minHeight: 280 }} />
        </div>
      </div>
    </section>
  );
}
