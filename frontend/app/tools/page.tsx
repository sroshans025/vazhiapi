"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PageHero from "@/components/PageHero";
import { apiBudgetPlan, apiEMI, apiInterest, apiPayoff, errorMessage } from "@/lib/api";
import { CATEGORY_META, fmtINR } from "@/lib/constants";

type Tab = "interest" | "emi" | "payoff" | "budget";
const TABS: { id: Tab; label: string }[] = [
  { id: "interest", label: "⚖️ True interest rate" },
  { id: "emi", label: "🧮 EMI calculator" },
  { id: "payoff", label: "🪜 Debt payoff planner" },
  { id: "budget", label: "📒 Budget planner" },
];

function Num({ label, value, onChange, step = 1, min = 0 }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input-field" type="number" inputMode="decimal" min={min} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function useDebounced<T>(fn: () => Promise<T>, deps: unknown[], delay = 350) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const id = setTimeout(() => { fn().then((d) => { setData(d); setErr(""); }).catch((e) => setErr(errorMessage(e))); }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, err };
}

function InterestTool() {
  const [rate, setRate] = useState(10);
  const [period, setPeriod] = useState("week");
  const [principal, setPrincipal] = useState(20000);
  const [months, setMonths] = useState(6);
  const ok = rate > 0 && principal > 0 && months > 0;
  const { data, err } = useDebounced(() => (ok ? apiInterest({ rate, period, principal, months }) : Promise.resolve(null)), [rate, period, principal, months]);
  return (
    <div className="grid-2">
      <div className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Moneylenders quote rates per day, week or month. Convert them to a yearly rate to compare with a bank or SHG loan.</p>
        <Num label="Interest rate (%)" value={rate} step={0.5} onChange={setRate} />
        <div className="tabs" style={{ marginBottom: 0 }}>
          {["day", "week", "month", "year"].map((p) => <button key={p} className={`chip ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>per {p}</button>)}
        </div>
        <Num label="Amount borrowed (₹)" value={principal} step={1000} onChange={setPrincipal} />
        <Num label="Months to repay" value={months} onChange={setMonths} min={1} />
      </div>
      <div className="glass-card card-pad">
        {err && <div className="error-box">{err}</div>}
        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>Yearly (simple) rate</div>
              <div className="big-num" style={{ color: data.likely_illegal_private_lending ? "#ef4444" : "#10b981" }}>{data.simple_annual_rate.toLocaleString("en-IN")}%</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>Effective with compounding: {data.effective_annual_rate >= 10000 ? "over 10,000" : data.effective_annual_rate.toLocaleString("en-IN")}%</div>
            </div>
            {data.likely_illegal_private_lending && <div className="error-box">⚖️ A private lender charging this much is very likely breaking the <b>TN Prohibition of Charging Exorbitant Interest Act, 2003</b>. Free legal help: <a href="tel:15100">15100</a>.</div>}
            <div className="grid-2" style={{ gap: "0.75rem" }}>
              <div><div className="muted" style={{ fontSize: "0.75rem" }}>Total you repay</div><div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fca5a5" }}>{fmtINR(data.total_payable_simple)}</div></div>
              <div><div className="muted" style={{ fontSize: "0.75rem" }}>Same via SHG (~10%)</div><div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#6ee7b7" }}>{fmtINR(data.shg_comparison_total)}</div></div>
            </div>
            <div>
              <div className="panel-label">Compare yearly rates</div>
              {[{ name: "This loan", apr: data.simple_annual_rate }, ...data.benchmarks].map((b: { name: string; apr: number }) => (
                <div key={b.name} style={{ marginBottom: "0.45rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}><span>{b.name}</span><span>{b.apr.toLocaleString("en-IN")}%</span></div>
                  <div className="bar"><div style={{ width: `${Math.min(100, (b.apr / Math.max(data.simple_annual_rate, 50)) * 100)}%`, background: b.name === "This loan" ? "#ef4444" : "#10b981" }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EMITool() {
  const [p, setP] = useState(100000);
  const [r, setR] = useState(12);
  const [m, setM] = useState(24);
  const ok = p > 0 && r >= 0 && m > 0;
  const { data, err } = useDebounced(() => (ok ? apiEMI({ principal: p, annual_rate: r, months: m }) : Promise.resolve(null)), [p, r, m]);
  return (
    <div className="grid-2">
      <div className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Num label="Loan amount (₹)" value={p} step={5000} onChange={setP} />
        <Num label="Interest rate (% per year)" value={r} step={0.5} onChange={setR} />
        <Num label="Tenure (months)" value={m} onChange={setM} min={1} />
      </div>
      <div className="glass-card card-pad">
        {err && <div className="error-box">{err}</div>}
        {data && (
          <>
            <div className="grid-3" style={{ gap: "0.75rem", marginBottom: "1rem" }}>
              <div><div className="muted" style={{ fontSize: "0.75rem" }}>Monthly EMI</div><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fcd34d" }}>{fmtINR(data.emi)}</div></div>
              <div><div className="muted" style={{ fontSize: "0.75rem" }}>Total interest</div><div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{fmtINR(data.total_interest)}</div></div>
              <div><div className="muted" style={{ fontSize: "0.75rem" }}>Total payable</div><div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{fmtINR(data.total_payable)}</div></div>
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              <table className="table">
                <thead><tr><th>Month</th><th>Interest</th><th>Principal</th><th>Balance</th></tr></thead>
                <tbody>{data.schedule.map((s: { month: number; interest: number; principal: number; balance: number }) => (
                  <tr key={s.month}><td>{s.month}</td><td>{fmtINR(s.interest)}</td><td>{fmtINR(s.principal)}</td><td>{fmtINR(s.balance)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type Debt = { name: string; balance: number; annual_rate: number; min_payment: number };
function PayoffTool() {
  const [debts, setDebts] = useState<Debt[]>([
    { name: "Moneylender", balance: 30000, annual_rate: 120, min_payment: 2000 },
    { name: "Credit card", balance: 45000, annual_rate: 42, min_payment: 2250 },
    { name: "Gold loan", balance: 60000, annual_rate: 12, min_payment: 1500 },
  ]);
  const [budget, setBudget] = useState(9000);
  const [strategy, setStrategy] = useState("avalanche");
  const valid = debts.length > 0 && debts.every((d) => d.name && d.balance > 0 && d.annual_rate >= 0 && d.min_payment >= 0) && budget > 0;
  const { data, err } = useDebounced(() => (valid ? apiPayoff({ monthly_budget: budget, strategy, debts }) : Promise.resolve(null)), [JSON.stringify(debts), budget, strategy], 450);
  const upd = (i: number, k: keyof Debt, v: string) => setDebts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: k === "name" ? v : parseFloat(v) } : d)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="glass-card card-pad">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Debt</th><th>Balance ₹</th><th>Interest %/yr</th><th>Minimum ₹/month</th><th /></tr></thead>
            <tbody>
              {debts.map((d, i) => (
                <tr key={i}>
                  <td><input className="input-field" style={{ padding: "0.5rem" }} value={d.name} onChange={(e) => upd(i, "name", e.target.value)} /></td>
                  <td><input className="input-field" style={{ padding: "0.5rem" }} type="number" value={d.balance} onChange={(e) => upd(i, "balance", e.target.value)} /></td>
                  <td><input className="input-field" style={{ padding: "0.5rem" }} type="number" value={d.annual_rate} onChange={(e) => upd(i, "annual_rate", e.target.value)} /></td>
                  <td><input className="input-field" style={{ padding: "0.5rem" }} type="number" value={d.min_payment} onChange={(e) => upd(i, "min_payment", e.target.value)} /></td>
                  <td><button className="icon-btn" aria-label="Remove" onClick={() => setDebts((ds) => ds.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "1rem" }}>
          <button className="btn-ghost btn-sm" onClick={() => setDebts((ds) => [...ds, { name: `Debt ${ds.length + 1}`, balance: 10000, annual_rate: 24, min_payment: 500 }])} disabled={debts.length >= 15}>＋ Add debt</button>
          <div style={{ width: 220 }}><Num label="Total I can pay per month (₹)" value={budget} step={500} onChange={setBudget} /></div>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`chip ${strategy === "avalanche" ? "active" : ""}`} onClick={() => setStrategy("avalanche")}>Avalanche (highest interest first)</button>
            <button className={`chip ${strategy === "snowball" ? "active" : ""}`} onClick={() => setStrategy("snowball")}>Snowball (smallest first)</button>
          </div>
        </div>
      </div>
      {err && <div className="error-box">{err}</div>}
      {data && (
        <div className="grid-2">
          <div className="glass-card card-pad">
            <div className="panel-label">Your plan · {data.strategy}</div>
            <div className="big-num" style={{ color: "#10b981" }}>{data.debt_free ? `${data.months} months` : "50+ years"}</div>
            <div className="muted" style={{ marginBottom: "0.75rem" }}>to be debt-free · total interest {fmtINR(data.total_interest)}</div>
            <div className="panel-label">Payoff order</div>
            <ol style={{ paddingLeft: "1.2rem" }}>{data.payoff_order.map((n: string) => <li key={n}>{n}</li>)}</ol>
          </div>
          <div className="glass-card card-pad">
            <div className="panel-label">Compared with {data.comparison.strategy}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{data.comparison.months} months · {fmtINR(data.comparison.total_interest)} interest</div>
            <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
              {data.total_interest <= data.comparison.total_interest
                ? `Your choice saves ${fmtINR(data.comparison.total_interest - data.total_interest)} in interest.`
                : `Switching to ${data.comparison.strategy} would save ${fmtINR(data.total_interest - data.comparison.total_interest)} — but snowball's quick wins can keep you motivated.`}
            </p>
            <p className="muted" style={{ fontSize: "0.8rem" }}>Tip: moving the moneylender balance to an SHG or MUDRA loan usually beats both strategies.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetTool() {
  const [income, setIncome] = useState(25000);
  const [emi, setEmi] = useState(11000);
  const [deps, setDeps] = useState(3);
  const [cat, setCat] = useState("blade_finance");
  const ok = income > 0 && emi >= 0;
  const { data, err } = useDebounced(() => (ok ? apiBudgetPlan({ monthly_income: income, debt_emi: emi, debt_category: cat, num_dependents: deps }) : Promise.resolve(null)), [income, emi, deps, cat]);
  const colors: Record<string, string> = { needs_essentials: "#3b82f6", debt_repayment: "#ef4444", savings_target: "#10b981", discretionary: "#a855f7" };
  return (
    <div className="grid-2">
      <div className="glass-card card-pad" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Num label="Monthly household income (₹)" value={income} step={1000} onChange={setIncome} />
        <Num label="Total loan repayments per month (₹)" value={emi} step={500} onChange={setEmi} />
        <Num label="Dependents" value={deps} onChange={setDeps} />
        <div>
          <label className="label">Main debt type</label>
          <select className="input-field" value={cat} onChange={(e) => setCat(e.target.value)}>
            {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
      </div>
      <div className="glass-card card-pad">
        {err && <div className="error-box">{err}</div>}
        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
              <span className="big-num" style={{ color: data.emi_to_income_ratio > 40 ? "#ef4444" : data.emi_to_income_ratio > 25 ? "#f59e0b" : "#10b981" }}>{data.emi_to_income_ratio}%</span>
              <span className="muted">of income goes to loans · <b style={{ textTransform: "capitalize" }}>{data.status.replace("_", " ")}</b></span>
            </div>
            <div style={{ display: "flex", height: 18, borderRadius: 999, overflow: "hidden" }}>
              {Object.entries(data.budget_allocation as Record<string, number>).map(([k, v]) => <div key={k} title={k} style={{ width: `${(v / income) * 100}%`, background: colors[k] }} />)}
            </div>
            {Object.entries(data.budget_allocation as Record<string, number>).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: colors[k], marginRight: 8 }} />{k.replace(/_/g, " ")}</span><b>{fmtINR(v)}</b>
              </div>
            ))}
            {data.shortfall > 0 && <div className="error-box">Shortfall of {fmtINR(data.shortfall)} per month: essentials and EMIs exceed income.</div>}
            <div className="benefit-box" style={{ fontSize: "0.86rem" }}>{data.recommendation}</div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>Emergency fund goal: {fmtINR(data.emergency_fund_target)} · Schemes: {data.suggested_schemes.join(", ")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>("interest");
  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <PageHero eyebrow="Free calculators · no sign-in" title={<span className="gradient-text">Money tools that tell the truth</span>}
            subtitle="See what that weekly interest really costs, plan EMIs, choose which debt to clear first, and build a budget that fits your household." />
          <div className="tabs">{TABS.map((t) => <button key={t.id} className={`chip ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
          {tab === "interest" && <InterestTool />}
          {tab === "emi" && <EMITool />}
          {tab === "payoff" && <PayoffTool />}
          {tab === "budget" && <BudgetTool />}
        </div>
      </div>
    </>
  );
}
