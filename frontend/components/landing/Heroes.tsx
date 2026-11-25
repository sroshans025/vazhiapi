"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StressGauge from "@/components/StressGauge";
import Markdown from "@/components/Markdown";
import { apiCategories, apiDemoAnalyse, apiSchemes, errorMessage } from "@/lib/api";
import { ACTION_ICONS, CATEGORY_META, fmtINR } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import type { AnalysisSummary, DebtCategory, GovernmentScheme } from "@/types";

/* ── helpers ─────────────────────────────────────────────── */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function useTypewriter(words: string[], speed = 55, pause = 1600) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const w = words[i % words.length];
    const id = setTimeout(() => {
      if (!del && n < w.length) setN(n + 1);
      else if (!del) setDel(true);
      else if (n > 0) setN(n - 1);
      else { setDel(false); setI(i + 1); }
    }, !del && n === w.length ? pause : del ? speed / 2 : speed);
    return () => clearTimeout(id);
  }, [n, del, i, words, speed, pause]);
  return words[i % words.length].slice(0, n);
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => { const p = Math.min((t - start) / 1200, 1); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{v.toLocaleString("en-IN")}{suffix}</span>;
}

/* ── Hero 1: live AI demo ─────────────────────────────────── */
const SAMPLES = [
  { label: "⚡ Kandhu vatti", text: "I borrowed ₹50,000 from a moneylender at 10% every week and the collector comes daily. I can't sleep." },
  { label: "📱 Loan app", text: "An instant loan app is calling my contacts and threatening to send morphed photos" },
  { label: "💛 Gold loan", text: "நகைக் கடன் தவணை தாண்டிவிட்டது, அடுத்த வாரம் ஏலம் என்று நோட்டீஸ் வந்தது" },
  { label: "🌾 Farm (Tanglish)", text: "mazhai illama nel payir pochu, crop loan katta mudiyala, romba tension ah irukku" },
  { label: "🎓 Education", text: "My education loan EMI started but I still don't have a job" },
];

export function HeroDemo() {
  const { lang } = useLang();
  const typed = useTypewriter(lang === "ta"
    ? ["உங்கள் வார்த்தைகளில்.", "தமிழில்.", "Tanglish-லும்.", "வெட்கமில்லாமல்."]
    : ["in your own words.", "in Tamil.", "in Tanglish.", "without shame."]);
  const [text, setText] = useState(SAMPLES[0].text);
  const [res, setRes] = useState<AnalysisSummary | null>(null);
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
    }, 550);
  };
  useEffect(() => {
    const id = setTimeout(() => run(SAMPLES[0].text), 0);
    return () => { clearTimeout(id); if (timer.current) clearTimeout(timer.current); };
     
  }, []);

  const meta = res ? CATEGORY_META[res.debt_category] : null;
  return (
    <section className="hero" style={{ padding: "7rem 1.25rem 4rem", minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div className="hero-orb" style={{ width: 420, height: 420, background: "#6d28d9", top: -80, left: -120 }} />
      <div className="hero-orb" style={{ width: 360, height: 360, background: "#f59e0b", bottom: -60, right: -80, opacity: 0.25, animationDelay: "-6s" }} />
      <div className="hero-grid" style={{ position: "relative", width: "100%" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: "1rem" }}>Tamil Nadu · AI financial wellness · Free</div>
          <h1 style={{ fontSize: "clamp(2.3rem, 5.5vw, 4.1rem)", fontWeight: 800, lineHeight: 1.08, marginBottom: "1rem" }}>
            <span className="gradient-text">VazhiAPI</span><br />
            <span className="font-tamil" style={{ fontSize: "0.55em", fontWeight: 700 }}>நம்ம பணம் நம்ம கையில்</span>
          </h1>
          <p style={{ fontSize: "clamp(1.05rem, 2vw, 1.3rem)", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
            {lang === "ta" ? "உங்கள் கடன் கவலையைச் சொல்லுங்கள் — " : "Tell us about your debt — "}
            <span className="typed" style={{ color: "#fcd34d", fontWeight: 600 }}>{typed}</span>
          </p>
          <p style={{ color: "var(--muted)", lineHeight: 1.8, maxWidth: 560, marginBottom: "2rem" }}>
            We score your stress, identify which of 12 Tamil Nadu debt traps you&apos;re in, explain your legal rights, and match
            you to 24 government schemes, in a counselling chat that remembers your story.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link href="/register" className="btn-primary" style={{ padding: "0.9rem 1.8rem" }}>Start free check-in →</Link>
            <a href="#calculator" className="btn-ghost" style={{ textDecoration: "none" }}>Is my interest legal?</a>
          </div>
          <p style={{ marginTop: "1.25rem", fontSize: "0.8rem" }} className="muted">🔒 Confidential · no shame · delete your data anytime</p>
        </div>

        <div className="glass-card demo-card" style={{ padding: "1.4rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 700 }}>✨ Try it live <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· no sign-up</span></div>
            {loading && <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
            {SAMPLES.map((s) => (
              <button key={s.label} className={`chip ${text === s.text ? "active" : ""}`} style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}
                onClick={() => { setText(s.text); run(s.text); }}>{s.label}</button>
            ))}
          </div>
          <textarea className="input-field" style={{ minHeight: 84, fontSize: "0.9rem" }} value={text} maxLength={600}
            aria-label="Describe a money worry" onChange={(e) => { setText(e.target.value); run(e.target.value); }} />
          {err && <div className="error-box" style={{ marginTop: "0.75rem" }}>{err}</div>}
          {res && (
            <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: "1rem", alignItems: "center" }}>
              <StressGauge score={res.stress_score} label={res.stress_label} size={118} caption="" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", minWidth: 0 }}>
                <span className="badge" style={{ alignSelf: "flex-start", background: `${meta?.color}22`, color: meta?.color, border: `1px solid ${meta?.color}55` }}>
                  {meta?.icon} {lang === "ta" ? res.debt_category_label_ta : res.debt_category_label}
                </span>
                <div style={{ fontSize: "0.85rem" }}>{ACTION_ICONS[res.rl_action]} <b>{res.rl_action_label}</b></div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  {res.language === "ta" ? "Tamil" : res.language === "tanglish" ? "Tanglish" : "English"} detected · {res.processing_time_ms} ms
                  {res.crisis.level !== "low" && <span style={{ color: "#fca5a5" }}> · {res.crisis.level} risk flags</span>}
                </div>
              </div>
            </div>
          )}
          {res?.refined_response && (
            <div style={{ marginTop: "0.9rem", maxHeight: 150, overflow: "hidden", position: "relative", fontSize: "0.85rem" }}>
              <Markdown text={res.refined_response.split("\n\n").slice(0, 2).join("\n\n")} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: "linear-gradient(transparent, rgba(27,23,66,0.98))" }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Hero 2: debt-trap calculator ─────────────────────────── */
export function TrapCalculator() {
  const ref = useReveal<HTMLElement>();
  const [principal, setPrincipal] = useState(50000);
  const [rate, setRate] = useState(10);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [months, setMonths] = useState(6);
  const n = { day: 365, week: 52, month: 12 }[period];
  const apr = rate * n;
  const periods = (months * n) / 12;
  const informal = principal + principal * (rate / 100) * periods;
  const shg = principal * (1 + 0.1 * (months / 12));
  const ratio = informal / shg;

  return (
    <section id="calculator" ref={ref} className="reveal" style={{ padding: "5rem 1.25rem", background: "rgba(0,0,0,0.22)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="eyebrow">Interactive · Debt-trap calculator</div>
          <h2 className="section-title">How much is that “small” interest really costing you?</h2>
          <p className="muted">Move the sliders. Kandhu vatti looks small per week and turns enormous per year.</p>
        </div>
        <div className="grid-2" style={{ alignItems: "stretch" }}>
          <div className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1.3rem" }}>
            <div>
              <label className="label">Amount borrowed: <b style={{ color: "#fcd34d" }}>{fmtINR(principal)}</b></label>
              <input type="range" min={5000} max={300000} step={5000} value={principal} onChange={(e) => setPrincipal(+e.target.value)} />
            </div>
            <div>
              <label className="label">Interest: <b style={{ color: "#fcd34d" }}>{rate}% per {period}</b></label>
              <input type="range" min={0.5} max={period === "day" ? 10 : 30} step={0.5} value={rate} onChange={(e) => setRate(+e.target.value)} />
              <div className="tabs" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
                {(["day", "week", "month"] as const).map((p) => (
                  <button key={p} className={`chip ${period === p ? "active" : ""}`} onClick={() => { setPeriod(p); if (p === "day") setRate(Math.min(rate, 10)); }}>per {p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Time to repay: <b style={{ color: "#fcd34d" }}>{months} months</b></label>
              <input type="range" min={1} max={24} value={months} onChange={(e) => setMonths(+e.target.value)} />
            </div>
          </div>
          <div className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.2rem" }}>
            <div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>That&apos;s a yearly rate of</div>
              <div className="big-num" style={{ color: apr > 36 ? "#ef4444" : "#10b981" }}>{apr.toLocaleString("en-IN")}%</div>
              {apr > 36 && <div style={{ color: "#fca5a5", fontSize: "0.82rem", marginTop: "0.35rem" }}>⚖️ Likely illegal under the TN Prohibition of Charging Exorbitant Interest Act, 2003</div>}
            </div>
            <div className="grid-2" style={{ gap: "0.75rem" }}>
              <div style={{ padding: "0.9rem", borderRadius: "0.8rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <div className="muted" style={{ fontSize: "0.72rem" }}>You repay (moneylender)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fca5a5" }}>{fmtINR(informal)}</div>
              </div>
              <div style={{ padding: "0.9rem", borderRadius: "0.8rem", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <div className="muted" style={{ fontSize: "0.72rem" }}>Same loan via SHG (~10%/yr)</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#6ee7b7" }}>{fmtINR(shg)}</div>
              </div>
            </div>
            <div style={{ fontSize: "0.9rem" }}>
              You&apos;d pay <b style={{ color: "#fcd34d" }}>{ratio.toFixed(1)}×</b> more, an extra <b style={{ color: "#fcd34d" }}>{fmtINR(informal - shg)}</b>.{" "}
              <Link href="/tools">Open the full calculators →</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Hero 3: category explorer ────────────────────────────── */
export function CategoryExplorer() {
  const ref = useReveal<HTMLElement>();
  const { lang } = useLang();
  const [cats, setCats] = useState<DebtCategory[]>([]);
  const [sel, setSel] = useState("blade_finance");
  useEffect(() => { apiCategories().then((d) => setCats(d.categories)).catch(() => {}); }, []);
  const ids = cats.length ? cats.map((c) => c.id) : Object.keys(CATEGORY_META);
  const cur = cats.find((c) => c.id === sel);
  const m = CATEGORY_META[sel];

  return (
    <section ref={ref} className="reveal" style={{ padding: "5rem 1.25rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="eyebrow">Interactive · 12 debt traps</div>
          <h2 className="section-title">Tap a debt trap to see your way out</h2>
          <p className="muted">Culturally specific patterns that generic finance apps miss, each with first steps and the law on your side.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: "1.5rem" }} className="explorer">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem", alignContent: "start" }}>
            {ids.map((id) => {
              const mm = CATEGORY_META[id];
              return (
                <button key={id} className={`cat-tile ${sel === id ? "sel" : ""}`} onClick={() => setSel(id)}
                  style={{ borderColor: sel === id ? mm.color : undefined, boxShadow: sel === id ? `0 0 24px ${mm.color}33` : undefined }}>
                  <div style={{ fontSize: "1.6rem" }}>{mm.icon}</div>
                  <div style={{ fontWeight: 700, color: mm.color, fontSize: "0.9rem", marginTop: "0.3rem" }}>{lang === "ta" ? mm.label_ta : mm.label}</div>
                </button>
              );
            })}
          </div>
          <div className="glass-card card-pad" key={sel} style={{ animation: "pop 0.25s ease", borderColor: `${m.color}55` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "2rem" }}>{m.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: m.color }}>{cur ? (lang === "ta" ? cur.label_ta : cur.label) : m.label}</div>
                {cur && <div className="muted" style={{ fontSize: "0.75rem" }}>Risk: {cur.risk_level} · Typical: {cur.typical_amounts}</div>}
              </div>
            </div>
            {cur ? (
              <>
                <p className={lang === "ta" ? "font-tamil" : ""} style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1rem" }}>
                  {lang === "ta" ? cur.description_ta : cur.description}
                </p>
                <div className="panel-label">First steps</div>
                <ol style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.86rem", marginBottom: "1rem" }}>
                  {(lang === "ta" ? cur.first_steps_ta : cur.first_steps).slice(0, 4).map((s) => <li key={s}>{s}</li>)}
                </ol>
                {cur.legal_status !== "—" && <div className="benefit-box" style={{ fontSize: "0.82rem" }}>⚖️ {cur.legal_status}</div>}
              </>
            ) : <div className="spinner" style={{ margin: "2rem auto" }} />}
            <Link href="/register" className="btn-primary btn-sm" style={{ marginTop: "1rem" }}>Get a personal plan →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Hero 4: 6-layer pipeline ─────────────────────────────── */
const LAYERS = [
  { k: "L1", t: "Stress Scorer", d: "Reads urgency, sentiment and fear in your words and scores stress from 0 to 100.", u: "FFNN · Unit I" },
  { k: "L2", t: "Debt Classifier", d: "Identifies which of 12 Tamil Nadu debt traps you're in, across English, Tamil and Tanglish.", u: "TextCNN · Unit II" },
  { k: "L3", t: "Trajectory Tracker", d: "Remembers your past check-ins and predicts whether stress is rising or easing.", u: "BiLSTM · Unit III-A" },
  { k: "L4", t: "Response Generator", d: "Writes a reply grounded in verified schemes, laws and first steps.", u: "Seq2Seq · Unit III-B" },
  { k: "L5", t: "Strategy Optimizer", d: "Chooses the intervention most likely to lower your stress: validate, rights, SHG or human help.", u: "PPO · Unit IV" },
  { k: "L6", t: "Tone Refiner", d: "Removes shame language and closes with an action step, in your language.", u: "Behaviour cloning · Unit V" },
];

export function PipelineHero() {
  const ref = useReveal<HTMLElement>();
  const [lit, setLit] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setLit((l) => (l + 1) % LAYERS.length), 1800);
    return () => clearInterval(id);
  }, [paused]);
  return (
    <section ref={ref} className="reveal" style={{ padding: "5rem 1.25rem", background: "rgba(0,0,0,0.22)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="eyebrow">How it works</div>
          <h2 className="section-title">Six AI layers, one caring reply</h2>
          <p className="muted">Hover or tap a layer. Every chat message runs through all six in milliseconds.</p>
        </div>
        <div className="grid-3" onMouseLeave={() => setPaused(false)}>
          {LAYERS.map((l, i) => (
            <button key={l.k} className={`layer-node ${lit === i ? "lit" : ""}`} onMouseEnter={() => { setPaused(true); setLit(i); }} onFocus={() => { setPaused(true); setLit(i); }} onClick={() => { setPaused(true); setLit(i); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span className="badge badge-saffron">{l.k}</span><span className="muted" style={{ fontSize: "0.7rem" }}>{l.u}</span>
              </div>
              <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>{l.t}</div>
              <div className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.55 }}>{l.d}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Hero 5: schemes marquee + stats + CTA ────────────────── */
export function SchemesAndCTA() {
  const ref = useReveal<HTMLElement>();
  const { lang } = useLang();
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  useEffect(() => { apiSchemes().then((d) => setSchemes(d.schemes)).catch(() => {}); }, []);
  const loop = useMemo(() => [...schemes, ...schemes], [schemes]);
  return (
    <section ref={ref} className="reveal" style={{ padding: "5rem 0 4rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto 2.5rem", padding: "0 1.25rem" }} className="grid-4">
        {[{ n: 24, s: "", l: "Govt schemes matched" }, { n: 12, s: "", l: "TN debt traps detected" }, { n: 14, s: "", l: "Laws explained simply" }, { n: 38, s: "", l: "Districts covered" }].map((x) => (
          <div key={x.l} className="glass-card" style={{ padding: "1.25rem", textAlign: "center" }}>
            <div className="stat-num gradient-text"><CountUp to={x.n} suffix={x.s} /></div>
            <div className="muted" style={{ fontSize: "0.82rem" }}>{x.l}</div>
          </div>
        ))}
      </div>
      {schemes.length > 0 && (
        <div className="marquee-wrap" style={{ marginBottom: "4rem" }}>
          <div className="marquee">
            {loop.map((s, i) => (
              <Link key={`${s.id}-${i}`} href="/schemes" className="chip" style={{ whiteSpace: "nowrap", padding: "0.6rem 1rem", textDecoration: "none" }}>
                🏛️ {lang === "ta" ? s.name_ta : s.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding: "0 1.25rem" }}>
        <div className="glow-border" style={{ maxWidth: 720, margin: "0 auto", background: "rgba(15,12,41,0.96)", borderRadius: "1.5rem", padding: "3rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.6rem", marginBottom: "0.75rem" }}>🛡️</div>
          <h2 className="section-title">Ready to find <span className="gradient-text">your path forward</span>?</h2>
          <p style={{ color: "var(--text-2)", marginBottom: "1.75rem", lineHeight: 1.8 }}>
            A confidential chat that understands kandhu vatti, chit funds and loan-app harassment, and knows the Tamil Nadu schemes and laws that help.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn-primary" style={{ padding: "1rem 2.2rem" }}>Start free · <span className="font-tamil">வழி தொடங்கு</span> →</Link>
            <Link href="/rights" className="btn-ghost" style={{ textDecoration: "none" }}>Know your rights</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
