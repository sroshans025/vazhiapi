/**
 * In-browser fallbacks for the public endpoints. Used when the VazhiAPI server is unreachable
 * (cold start, outage, or a frontend preview pointed at an older backend), so the landing page,
 * schemes, rights and tools keep working. Mirrors the backend logic in simplified form.
 */
import KB from "@/lib/kb.json";
import type { AnalysisSummary, DebtCategory, GovernmentScheme, Helpline, Law } from "@/types";

export const kb = KB as unknown as {
  categories: (DebtCategory & { indicators: string[]; laws: string[] })[];
  schemes: (GovernmentScheme & { criteria?: Record<string, unknown> })[];
  laws: Law[];
  helplines: Helpline[];
  districts: string[];
  nlp: { crisis: string[]; severe: string[]; high: string[]; urgency: Record<string, number>; tanglish: string[] };
};

const TAMIL = /[஀-௿]/;
const norm = (t: string) => t.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s஀-௿']/gu, " ").replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hit(phrase: string, text: string) {
  const p = norm(phrase);
  if (!p) return false;
  if (TAMIL.test(p)) return text.includes(p);
  return new RegExp(`(?<![a-z0-9])${esc(p)}(?![a-z0-9])`).test(text);
}

// ── Knowledge helpers ─────────────────────────────────────────────
export const schemesFor = (cat: string, n?: number) => {
  const s = kb.schemes.filter((x) => x.applicable_categories.includes(cat));
  return n ? s.slice(0, n) : s;
};
export const lawsFor = (cat: string) => kb.laws.filter((l) => l.categories.includes(cat));
export function helplinesFor(tags: string[], n = 4) {
  return kb.helplines
    .map((h) => [h.for.filter((f) => tags.includes(f)).length, h] as const)
    .filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, h]) => h);
}

export function filterSchemes(p?: { category?: string; q?: string; level?: string }) {
  let s = kb.schemes;
  if (p?.category) s = s.filter((x) => x.applicable_categories.includes(p.category!));
  if (p?.level) s = s.filter((x) => x.level === p.level);
  if (p?.q) { const q = p.q.toLowerCase(); s = s.filter((x) => (x.name + x.description + x.type + x.name_ta).toLowerCase().includes(q)); }
  return { schemes: s, count: s.length, total: kb.schemes.length };
}

export function matchSchemes(profile: Record<string, unknown>) {
  const { gender, age, annual_income: income, occupation, community, debt_category: cat } = profile as {
    gender?: string; age?: number; annual_income?: number; occupation?: string; community?: string; debt_category?: string };
  const student = profile.student === true || occupation === "student";
  const out: GovernmentScheme[] = [];
  for (const s of kb.schemes) {
    const c = (s.criteria ?? {}) as Record<string, unknown>;
    let score = 50; const reasons: string[] = []; let blocked = false;
    if (c.gender) {
      if (gender === c.gender) { score += 15; reasons.push(`For ${c.gender} applicants`); }
      else if (gender && c.or_gender !== gender) blocked = true;
    }
    if (c.community) {
      if ((c.community as string[]).includes(community ?? "") || (c.or_gender && gender === c.or_gender)) { score += 15; reasons.push("Matches community / gender priority"); }
      else if (community || gender) blocked = true;
    }
    if (c.max_income != null && income != null) {
      if (income <= (c.max_income as number)) { score += 15; reasons.push(`Income within ₹${(c.max_income as number).toLocaleString("en-IN")} limit`); } else blocked = true;
    }
    if (c.min_age != null && age != null && age < (c.min_age as number)) blocked = true;
    if (c.max_age != null && age != null && age > (c.max_age as number)) blocked = true;
    if (c.occupation) {
      if ((c.occupation as string[]).includes(occupation ?? "")) { score += 20; reasons.push("Matches your occupation"); } else if (occupation) score -= 25;
    }
    if (c.student) { if (student) { score += 20; reasons.push("For students"); } else score -= 30; }
    if (cat && s.applicable_categories.includes(cat)) { score += 15; reasons.push("Relevant to your debt situation"); }
    if (!blocked) out.push({ ...s, match_score: Math.max(0, Math.min(100, score)), match_reasons: reasons });
  }
  out.sort((a, b) => (b.match_score! - a.match_score!) || a.priority - b.priority);
  return { schemes: out, count: out.length };
}

// ── Demo analyser ─────────────────────────────────────────────────
const ACTIONS = {
  validate: ["Validate & Acknowledge", "Your feelings are valid. Let's understand what happened and why this is not your fault."],
  legal_rights: ["Know Your Legal Rights", "You have rights under TN Money Lenders Act and RBI guidelines. Let me explain them."],
  shg_alternative: ["SHG / Govt Scheme Alternative", "A Self Help Group or government scheme can provide interest-free credit. Let's find one near you."],
  escalate: ["Connect to Human Counsellor", "This situation needs immediate human support. A counsellor can be notified, and the helplines below are free and confidential."],
} as const;

export function analyzeLocal(text: string): AnalysisSummary {
  const t0 = performance.now();
  const n = norm(text);
  const words = new Set(n.match(/[a-z]+/g) ?? []);
  const tl = kb.nlp.tanglish.filter((w) => words.has(w)).length;
  const language = TAMIL.test(text) ? "ta" : tl >= 2 || (words.size <= 6 && tl > 0) ? "tanglish" : "en";

  const flags: { phrase: string; severity: string }[] = [];
  for (const [sev, list] of [["critical", kb.nlp.crisis], ["severe", kb.nlp.severe], ["high", kb.nlp.high]] as const)
    for (const p of list) if (hit(p, n)) flags.push({ phrase: p, severity: sev });
  const level = (["critical", "severe", "high"] as const).find((l) => flags.some((f) => f.severity === l)) ?? "low";

  // category from curated indicators
  const scores = kb.categories.map((c) => c.indicators.reduce((s, k) => s + (hit(k, n) ? 1 + 0.3 * (norm(k).split(" ").length - 1) : 0), 0));
  const total = scores.reduce((a, b) => a + b, 0);
  const genIdx = kb.categories.findIndex((c) => c.id === "general_financial_stress");
  const top = total > 0 ? scores.indexOf(Math.max(...scores)) : genIdx;
  const probs: Record<string, number> = {};
  kb.categories.map((c, i) => [c.id, total > 0 ? scores[i] / total : i === genIdx ? 1 : 0] as const)
    .sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { probs[k] = Math.round(v * 1000) / 1000; });
  const cat = kb.categories[top];

  // stress from urgency lexicon
  let urg = 0;
  for (const [k, w] of Object.entries(kb.nlp.urgency)) if (hit(k, n)) urg += w;
  let stress = Math.min(97, 18 + Math.min(urg / 10, 1) * 55 + Math.min(total, 4) * 4);
  if ((n.split(" ").length <= 3) && total === 0 && urg === 0) stress = Math.min(stress, 15);
  if (level === "critical") stress = Math.max(stress, 90); else if (level === "severe") stress = Math.max(stress, 72); else if (level === "high") stress = Math.max(stress, 55);
  stress = Math.round(stress * 10) / 10;
  const label = stress >= 75 ? "Critical" : stress >= 50 ? "High" : stress >= 25 ? "Moderate" : "Low";

  let action: keyof typeof ACTIONS = stress >= 80 ? "escalate" : stress >= 55 || (["loan_app_harassment", "blade_finance"].includes(cat.id) && stress >= 40) ? "legal_rights" : stress >= 35 ? "shg_alternative" : "validate";
  if (level === "critical" || level === "severe") action = "escalate";

  const ta = language === "ta";
  const intro = ta
    ? `சொன்னதற்கு நன்றி. ${cat.label_ta} — இது உங்கள் தவறு அல்ல, வெளியே வர வழிகள் உள்ளன.`
    : `Thank you for sharing this. ${cat.label} is a common trap in Tamil Nadu, and it is not a personal failure. There are concrete ways out.`;
  const steps = (ta ? cat.first_steps_ta : cat.first_steps).slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n");
  const crisisLine = level === "critical" ? (ta ? "\n\nஇப்போதே 14416 (டெலி-மனஸ்) அல்லது 112 அழையுங்கள் — உங்கள் உயிர் எந்தக் கடனையும் விட முக்கியம்." : "\n\nPlease call **14416** (Tele-MANAS, 24×7) or **112** now. Your life matters more than any debt.") : "";
  const tags = [cat.id, ...(level === "critical" ? ["crisis"] : []), ...(level === "severe" ? ["threat"] : []), ...(stress >= 50 ? ["stress"] : [])];

  return {
    stress_score: stress, stress_label: label, debt_category: cat.id, debt_category_label: cat.label,
    debt_category_label_ta: cat.label_ta, debt_category_icon: cat.icon, debt_category_color: cat.color,
    debt_category_probabilities: probs, rl_action: action, rl_action_label: ACTIONS[action][0], rl_action_description: ACTIONS[action][1],
    language, processing_time_ms: Math.round((performance.now() - t0) * 10) / 10,
    crisis: { level, should_escalate: level === "critical" || level === "severe", triggered_flags: flags },
    refined_response: `${intro}\n\n${ta ? "இப்போது செய்யக்கூடியவை:" : "What you can do now:"}\n${steps}${crisisLine}`,
    matched_schemes: schemesFor(cat.id, 3).map(({ id, name, name_ta, benefit, helpline, application_url, type }) => ({ id, name, name_ta, benefit, helpline, application_url, type })),
    helplines: helplinesFor(tags, 3),
  };
}

// ── Calculators ───────────────────────────────────────────────────
const PERIODS: Record<string, number> = { day: 365, week: 52, month: 12, year: 1 };
const BENCHMARKS = [
  { name: "Kisan Credit Card (prompt repayment)", apr: 4 }, { name: "SHG bank linkage", apr: 10 },
  { name: "MUDRA / bank personal loan", apr: 12 }, { name: "Gold loan (bank)", apr: 9 }, { name: "Credit card (revolving)", apr: 42 },
];

export function interest(d: { rate: number; period: string; principal?: number; months?: number }) {
  const n = PERIODS[d.period];
  const simple = d.rate * n;
  const eff = Math.min((Math.pow(1 + d.rate / 100, n) - 1) * 100, 1e9);
  const out: Record<string, unknown> = {
    rate: d.rate, period: d.period, simple_annual_rate: Math.round(simple * 10) / 10, effective_annual_rate: Math.round(eff * 10) / 10,
    likely_illegal_private_lending: simple > 36, benchmarks: BENCHMARKS,
  };
  if (d.principal && d.months) {
    const periods = (d.months * n) / 12;
    const si = d.principal * (d.rate / 100) * periods;
    Object.assign(out, {
      principal: d.principal, months: d.months, simple_interest: Math.round(si), total_payable_simple: Math.round(d.principal + si),
      total_payable_compound: Math.round(Math.min(d.principal * Math.pow(1 + d.rate / 100, periods), 1e12)),
      shg_comparison_total: Math.round(d.principal * (1 + 0.1 * (d.months / 12))),
    });
  }
  return out;
}

export function emi(d: { principal: number; annual_rate: number; months: number }) {
  const r = d.annual_rate / 1200;
  const e = r === 0 ? d.principal / d.months : (d.principal * r * Math.pow(1 + r, d.months)) / (Math.pow(1 + r, d.months) - 1);
  let bal = d.principal; const schedule = [];
  for (let m = 1; m <= d.months; m++) {
    const i = bal * r, p = e - i; bal = Math.max(bal - p, 0);
    if (m <= 12 || m === d.months || m % 12 === 0) schedule.push({ month: m, interest: Math.round(i), principal: Math.round(p), balance: Math.round(bal) });
  }
  return { emi: Math.round(e), total_payable: Math.round(e * d.months), total_interest: Math.round(e * d.months - d.principal), schedule };
}

type Debt = { name: string; balance: number; annual_rate: number; min_payment: number };
function simulate(debts0: Debt[], budget: number, strategy: string) {
  const debts = debts0.map((d) => ({ ...d }));
  const order = strategy === "avalanche" ? (a: Debt, b: Debt) => b.annual_rate - a.annual_rate : (a: Debt, b: Debt) => a.balance - b.balance;
  let month = 0, ti = 0; const done: string[] = [];
  while (debts.some((d) => d.balance > 0.5) && month < 600) {
    month++;
    for (const d of debts) if (d.balance > 0) { const i = (d.balance * d.annual_rate) / 1200; d.balance += i; ti += i; }
    let rem = budget;
    for (const d of debts) { const p = Math.min(d.min_payment, d.balance, rem); d.balance -= p; rem -= p; }
    for (const d of debts.filter((x) => x.balance > 0.5).sort(order)) { const p = Math.min(d.balance, rem); d.balance -= p; rem -= p; if (rem <= 0) break; }
    for (const d of debts) if (d.balance <= 0.5 && !done.includes(d.name)) { done.push(d.name); d.balance = 0; }
  }
  return { months: month, total_interest: Math.round(ti), payoff_order: done, debt_free: month < 600 };
}

export function payoff(d: { monthly_budget: number; strategy: string; debts: Debt[] }) {
  const minTotal = d.debts.reduce((s, x) => s + x.min_payment, 0);
  if (d.monthly_budget < minTotal) throw { response: { data: { detail: `Monthly budget must cover the minimum payments (₹${Math.round(minTotal).toLocaleString("en-IN")})` } } };
  const other = d.strategy === "avalanche" ? "snowball" : "avalanche";
  return { strategy: d.strategy, ...simulate(d.debts, d.monthly_budget, d.strategy), comparison: { strategy: other, ...simulate(d.debts, d.monthly_budget, other) } };
}

export function budgetPlan(d: { monthly_income: number; debt_emi: number; debt_category: string; num_dependents?: number; rent?: number }) {
  const income = d.monthly_income, emiAmt = d.debt_emi, pct = (emiAmt / income) * 100;
  const essentials = Math.max((income * Math.min(45 + 2.5 * (d.num_dependents ?? 2), 65)) / 100, d.rent ?? 0);
  const after = income - essentials, paid = Math.min(emiAmt, Math.max(after, 0));
  const shortfall = Math.max(emiAmt - paid, 0) + Math.max(essentials - income, 0);
  const left = Math.max(after - paid, 0), savings = Math.round(left * 0.5);
  const [status, recommendation] = pct > 50
    ? ["critical", "Your loan repayments take more than half your income — a debt trap. Ask every lender in writing for a longer tenure or moratorium, get free legal help (DLSA 15100), and don't borrow again to repay."]
    : pct > 40 ? ["distressed", "EMIs above 40% of income leave no buffer. Move the highest-interest loan to SHG/MUDRA credit and request restructuring before you miss a payment."]
    : pct > 25 ? ["at_risk", "EMI burden is high. Clear the highest-interest debt first and build a small emergency fund."]
    : ["manageable", "Your debt ratio is manageable. Build an emergency fund of 3 months' expenses."];
  return {
    monthly_income: income, debt_emi: emiAmt, emi_to_income_ratio: Math.round(pct * 10) / 10, status, recommendation, shortfall: Math.round(shortfall),
    budget_allocation: { needs_essentials: Math.round(essentials), debt_repayment: Math.round(paid), savings_target: savings, discretionary: Math.round(left - savings) },
    monthly_savings_target: savings, emergency_fund_target: Math.round(essentials * 3), debt_category: d.debt_category,
    suggested_schemes: schemesFor(d.debt_category, 3).map((s) => s.name),
  };
}
