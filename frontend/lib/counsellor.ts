/**
 * In-browser Vazhi counsellor — a port of backend/counsel/engine.py::LocalCounsellor.
 * Powers guest mode (no account / no reachable server). Grounded in the bundled knowledge base:
 * 66 Q&A entries, 24 schemes, 14 laws, 14 helplines, 12 debt categories.
 */
import type { AnalysisSummary, MsgLanguage } from "@/types";
import { helplinesFor, kb, lawsFor, schemesFor, searchKb, type FaqEntry, type KbHit } from "@/lib/offline";

const FAQ_MIN = 5.0;
type Ctx = { message: string; lang: MsgLanguage; a: AnalysisSummary; history: { role: string; meta?: { category?: string } }[]; name?: string | null; district?: string | null };

const T = (lang: MsgLanguage, en: string, ta: string, tl?: string) => (lang === "ta" ? ta : lang === "tanglish" ? tl ?? en : en);
const has = (t: string, p: string) => (/[஀-௿%]/.test(p) ? t.includes(p) : new RegExp(`(?<![a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(t));

const INTENTS: [string, string[]][] = [
  ["human", ["talk to a human", "real person", "counsellor", "counselor", "call me", "human support", "aalu kitta pesanum", "ஆலோசகர்"]],
  ["helpline", ["helpline", "phone number", "contact number", "who can i call", "number to call", "உதவி எண்", "help number"]],
  ["about", ["what can you do", "who are you", "what is vazhi", "what is vazhiapi", "how can you help", "what do you do", "nee yaar", "neenga yaar", "நீங்கள் யார்"]],
  ["scheme", ["scheme", "schemes", "government help", "govt", "subsidy", "yojana", "thittam", "திட்டம்", "eligible", "apply for"]],
  ["rights", ["legal", "law", "rights", "police", "complaint", "court", "illegal", "sattam", "சட்டம்", "உரிமை", "புகார்"]],
  ["interest", ["interest rate", "how much interest", "per day", "per week", "per month", "percent", "%", "apr", "vatti evlo"]],
  ["budget", ["budget", "salary", "income", "save money", "savings", "monthly expenses", "plan my", "சம்பளம்", "சேமிப்பு"]],
  ["thanks", ["thank", "thanks", "nandri", "நன்றி", "helpful"]],
  ["greeting", ["hi", "hello", "hey", "vanakkam", "வணக்கம்", "good morning", "good evening"]],
];

function parseRate(text: string): [number, string] | null {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\s*(?:interest\s*)?(?:per|a|every|\/)?\s*(day|daily|week|weekly|month|monthly|year|annum)/);
  if (!m) return null;
  const u = m[2].startsWith("da") ? "day" : m[2].startsWith("week") ? "week" : m[2].startsWith("month") ? "month" : "year";
  return [parseFloat(m[1]), u];
}
function parseAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.toLowerCase().matchAll(/(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(lakh|lakhs|k|thousand)?/g)) {
    let v = parseFloat(m[1].replace(/,/g, ""));
    if (m[2]?.startsWith("lakh")) v *= 100000; else if (m[2] === "k" || m[2] === "thousand") v *= 1000;
    if (v >= 100) out.push(v);
  }
  return out;
}

export function detectIntent(message: string, a: AnalysisSummary, hits: KbHit[]): string {
  const t = message.toLowerCase().trim();
  if (a.crisis.level === "critical") return "crisis";
  const found = INTENTS.filter(([, ps]) => ps.some((p) => has(t, p))).map(([n]) => n);
  const words = t.split(/\s+/).length;
  const fin = Object.values(a.debt_category_probabilities).length > 0 && a.debt_category !== "general_financial_stress";
  if (found.includes("greeting") && words <= 4 && !fin) return "greeting";
  if (found.includes("thanks") && words <= 8 && !fin) return "thanks";
  for (const n of ["human", "helpline", "about"]) if (found.includes(n)) return n;
  const calm = a.stress_score < 55 && a.crisis.level === "low";
  if (found.includes("interest") && parseRate(message) && calm) return "interest";
  if (found.includes("budget") && parseAmounts(message).length) return "budget";
  if (hits[0]?.kind === "faq" && hits[0].score >= FAQ_MIN) return "faq";
  for (const n of ["scheme", "rights", ...(calm ? ["interest", "budget"] : [])]) if (found.includes(n)) return n;
  if (!fin && a.stress_score < 45 && words >= 3 && !hits.some((h) => h.kind === "faq" && h.score >= FAQ_MIN * 0.6)) return "general";
  return "distress";
}

const SUG = {
  en: { schemes: "Which government schemes can help me?", rights: "What are my legal rights?", interest: "Calculate the real interest I'm paying",
    budget: "Help me make a monthly budget", helpline: "Who can I call right now?", human: "I want to talk to a human counsellor", steps: "What should I do first?",
    cibil: "How can I improve my credit score?", fraud: "What do I do if I'm scammed online?" },
  ta: { schemes: "எந்த அரசு திட்டங்கள் உதவும்?", rights: "என் சட்ட உரிமைகள் என்ன?", interest: "நான் கட்டும் உண்மையான வட்டி எவ்வளவு?",
    budget: "மாத பட்ஜெட் போட உதவுங்கள்", helpline: "இப்போது யாரை அழைக்கலாம்?", human: "ஆலோசகரிடம் பேச வேண்டும்", steps: "முதலில் என்ன செய்ய வேண்டும்?",
    cibil: "கிரெடிட் ஸ்கோரை எப்படி உயர்த்துவது?", fraud: "ஆன்லைன் மோசடியில் சிக்கினால் என்ன செய்வது?" },
};
export function suggestionsFor(intent: string, a: AnalysisSummary, lang: MsgLanguage): string[] {
  const s = SUG[lang === "ta" ? "ta" : "en"];
  let keys: (keyof typeof s)[];
  if (intent === "crisis") keys = ["helpline", "human", "steps"];
  else if (["greeting", "thanks", "general"].includes(intent)) keys = ["steps", "schemes", "cibil"];
  else if (intent === "faq") keys = ["schemes", "rights", "budget"];
  else if (intent === "scheme") keys = ["rights", "budget", "human"];
  else if (intent === "rights") keys = ["schemes", "helpline", "steps"];
  else if (intent === "interest") keys = ["rights", "schemes", "budget"];
  else if (intent === "budget") keys = ["schemes", "interest", "steps"];
  else {
    keys = ["schemes", "rights", ["blade_finance", "microfinance_debt", "loan_app_harassment", "credit_card_debt", "gold_loan_overdue"].includes(a.debt_category) ? "interest" : "budget"];
    if (a.stress_score >= 70) keys = ["helpline", "human", keys[0]];
  }
  return keys.map((k) => s[k]);
}

const helplineLines = (tags: string[], n = 4) => helplinesFor(tags, n).map((h) => `- **${h.name}**: **${h.number}** (${h.hours})`).join("\n");
const schemeLines = (cat: string, lang: MsgLanguage, n = 3) => schemesFor(cat, n)
  .map((s) => `- **${lang === "ta" ? s.name_ta : s.name}** — ${lang === "ta" ? s.description_ta : s.benefit}  \n  Helpline ${s.helpline} · ${s.application_url}`).join("\n");

function compose(cat: string, label: string, lang: MsgLanguage): string {
  const c = kb.categories.find((x) => x.id === cat)!;
  const ta = lang === "ta";
  const lvl = label === "Critical" || label === "High" ? "high" : label === "Moderate" ? "moderate" : "low";
  const nm = ta ? c.label_ta : c.label;
  const v = {
    high: T(lang, `That sounds really heavy, and it makes sense that you're scared. This is not a personal failure — ${nm} traps are designed to be hard to escape.`,
      `நீங்கள் சொல்வது மிகவும் கனமானது, பயப்படுவது இயல்பு. இது உங்கள் தவறு அல்ல — ${nm} வேண்டுமென்றே தப்பிக்க கடினமாக வடிவமைக்கப்பட்டது.`,
      `Neenga sollradhu romba kashtamana vishayam, bayam varadhu normal dhaan. Idhu unga thappu illa — ${nm} trap ah vechi dhaan design panniruppanga.`),
    moderate: T(lang, `Thank you for telling me. ${nm} is a common pressure in Tamil Nadu households, and there are concrete ways out.`,
      `சொன்னதற்கு நன்றி. ${nm} தமிழ்நாட்டில் பல குடும்பங்கள் சந்திக்கும் பிரச்சனை — வெளியே வர தெளிவான வழிகள் உள்ளன.`,
      `Sonnadhukku nandri. ${nm} Tamil Nadu la niraya families ku varra problem dhaan — veliya vara clear ana vazhigal irukku.`),
    low: T(lang, `Good that you're looking at this early — planning now keeps ${nm} from growing.`, `முன்கூட்டியே யோசிப்பது நல்லது — இப்போதே திட்டமிட்டால் ${nm} பெரிதாகாது.`,
      `Munnadiye yosikkareenga, nalla vishayam — ippove plan panna ${nm} periyadhaagadhu.`),
  }[lvl];
  const parts = [v];
  const steps = ta ? c.first_steps_ta : c.first_steps;
  if (steps.length) parts.push(T(lang, "What you can do now:", "இப்போது செய்யக்கூடியவை:", "Ippo pannakoodiyadhu:") + "\n" + steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n"));
  const sc = schemesFor(cat, 1)[0];
  if (sc) parts.push(`${T(lang, "Support you may qualify for:", "உங்களுக்கு உதவக்கூடிய திட்டம்:", "Ungalukku help aagura scheme:")} **${ta ? sc.name_ta : sc.name}** — ${ta ? sc.description_ta : sc.benefit} (Helpline ${sc.helpline})`);
  const law = lawsFor(cat)[0];
  if (law && lvl !== "low") parts.push(`${T(lang, "Your right:", "உங்கள் உரிமை:", "Unga urimai:")} ${ta ? law.summary_ta : law.summary}`);
  return parts.join("\n\n");
}

export function reply(ctx: Ctx): { text: string; intent: string; hits: KbHit[] } {
  const { a, lang } = ctx;
  const hits = searchKb(ctx.message, 4);
  let intent = detectIntent(ctx.message, a, hits);
  const cat = a.debt_category;
  const c = kb.categories.find((x) => x.id === cat)!;
  const catLabel = lang === "ta" ? c.label_ta : c.label;
  const name = (ctx.name || "").split(" ")[0];
  const nm = name && name !== "Guest" ? `${name}, ` : "";
  let text: string;

  if (intent === "about") {
    const about = kb.faq.find((e) => e.id === "what_is_vazhi")!;
    hits.unshift({ kind: "faq", id: about.id, title: about.q[0], score: 99, item: about as unknown as Record<string, unknown> });
    intent = "faq";
  }

  switch (intent) {
    case "crisis":
      text = T(lang,
        `${nm}I'm really glad you told me. What you're carrying right now is too much for anyone alone, and your life matters far more than any loan.\n\n**Please reach out right now — it's free and confidential:**\n${helplineLines(["crisis"], 3)}\n\nIf you are in immediate danger, call **112**.\n\nWhen you feel a little steadier, I'm here to work through the debt with you step by step — there *are* legal protections and schemes for exactly this situation.`,
        `${nm}சொன்னதற்கு மிக்க நன்றி. நீங்கள் சுமக்கும் பாரம் யாருக்கும் தனியாக அதிகம் — எந்தக் கடனையும் விட உங்கள் உயிர் முக்கியம்.\n\n**தயவுசெய்து இப்போதே அழையுங்கள் — இலவசம், ரகசியம்:**\n${helplineLines(["crisis"], 3)}\n\nஉடனடி ஆபத்து என்றால் **112**.\n\nகொஞ்சம் அமைதியானதும், கடனை படிப்படியாக சேர்ந்து சமாளிப்போம்.`,
        `${nm}sonnadhukku romba nandri. Neenga thaniya idha sumakka vendiyadhu illa — endha kadanum unga uyir vida periyadhu illa.\n\n**Ippove call pannunga — free, confidential:**\n${helplineLines(["crisis"], 3)}\n\nUdanadi aabathu na **112**.\n\nKonjam calm aanadhum, kadanai step by step sendhu paarthukalaam.`);
      break;
    case "greeting":
      text = T(lang,
        `Vanakkam${name && name !== "Guest" ? " " + name : ""}! I'm Vazhi, your financial wellness companion. Ask me anything about loans, moneylenders, chit funds, loan apps, schemes, your rights, budgeting, scams or credit scores — in English, Tamil or Tanglish.\n\nWhat's on your mind today?`,
        `வணக்கம்${name && name !== "Guest" ? " " + name : ""}! நான் வழி — உங்கள் நிதி நலத் துணை. கடன், வட்டி, சீட்டு, கடன் செயலி, அரசு திட்டங்கள், உரிமைகள், பட்ஜெட், மோசடி — எதைப் பற்றியும் கேளுங்கள்.\n\nஇன்று உங்கள் மனதில் என்ன இருக்கிறது?`,
        `Vanakkam${name && name !== "Guest" ? " " + name : ""}! Naan Vazhi. Kadan, vatti, seettu, loan app, schemes, urimai, budget, scam — edhu venumnaalum kelunga.\n\nInniku enna vishayam?`);
      break;
    case "thanks":
      text = T(lang, "You're welcome — and well done for taking these steps. Is there anything else worrying you?", "நன்றி! இந்த முயற்சிக்கு பாராட்டுகள். வேறு ஏதாவது கவலை இருக்கிறதா?", "Paravaillai! Vera edhaachum tension irukka?");
      break;
    case "human":
      text = T(lang, "Of course. If you'd like to speak to someone right now, these are free and confidential:\n", "நிச்சயமாக. இப்போதே பேச வேண்டுமென்றால் (இலவசம், ரகசியம்):\n", "Kandippa. Ippove pesanum na (free, confidential):\n")
        + helplineLines(["stress", cat], 3) + T(lang, "\n\nYou can also tap **Talk to a counsellor** above.", "\n\nமேலே உள்ள **ஆலோசகரிடம் பேசு** பொத்தானையும் அழுத்தலாம்.", "\n\nMela **Talk to a counsellor** button um press pannalaam.");
      break;
    case "helpline":
      text = T(lang, "Here are the free numbers most relevant to your situation:\n\n", "உங்கள் சூழலுக்கு பொருத்தமான இலவச எண்கள்:\n\n", "Unga situation ku useful aana free numbers:\n\n")
        + helplineLines([cat, "stress", ...(a.crisis.level === "severe" ? ["threat"] : [])], 5);
      break;
    case "faq": {
      const top = hits[0].item as unknown as FaqEntry;
      const parts: string[] = [];
      if (a.stress_score >= 55 && a.crisis.level !== "low") parts.push(T(lang, "That sounds stressful — let's take it one step at a time.", "இது கஷ்டமான நிலை — ஒவ்வொரு படியாக பார்ப்போம்.", "Idhu kashtamana nilamai — onnu onna paarpom."));
      if (lang === "ta") parts.push("_(விரிவான தகவல் கீழே ஆங்கிலத்தில்)_");
      parts.push(top.a);
      const related = hits.slice(1).filter((h) => h.kind === "faq" && h.score >= hits[0].score * 0.55).slice(0, 2);
      if (related.length) parts.push(T(lang, "Related: ", "தொடர்புடையவை: ", "Related: ") + related.map((h) => `*${h.title}*`).join(" · "));
      if (a.crisis.level === "severe") parts.push(T(lang, "Threats or harassment are crimes — call **100 / 112** if you feel unsafe.", "மிரட்டல் குற்றம் — பாதுகாப்பில்லை என்றால் **100 / 112**.", "Mirattal crime — safe ah illa na **100 / 112**."));
      text = parts.join("\n\n");
      break;
    }
    case "general":
      text = T(lang,
        "I'm best at **money, debt, rights and wellbeing questions for Tamil Nadu**, so I can't answer that one reliably in this mode. Here are things I can help with right away:\n- *“How can I improve my CIBIL score?”*\n- *“Someone took money from my UPI — what do I do?”*\n- *“What documents do I need for government schemes?”*\n- *“Is 10% per week interest legal?”*\n\nOr just tell me what's worrying you.",
        "நான் **பணம், கடன், உரிமைகள், நலம்** தொடர்பான கேள்விகளுக்கு சிறப்பாக உதவுவேன்; அந்தக் கேள்விக்கு இங்கே சரியான பதில் தர முடியாது. இவற்றைக் கேளுங்கள்:\n- *“என் CIBIL ஸ்கோரை எப்படி உயர்த்துவது?”*\n- *“UPI மோசடியில் பணம் போனது — என்ன செய்வது?”*\n- *“அரசு திட்டங்களுக்கு என்ன ஆவணங்கள் வேண்டும்?”*",
        "Naan **panam, kadan, urimai, wellbeing** questions la dhaan best ah help pannuven. Idha try pannunga:\n- *“CIBIL score epdi improve panradhu?”*\n- *“UPI fraud la panam pochu, enna pannanum?”*\n- *“Scheme ku enna documents venum?”*");
      break;
    case "scheme":
      text = T(lang, `Based on what you've shared (**${catLabel}**), these schemes are the best fit:\n\n`, `நீங்கள் சொன்னதன் அடிப்படையில் (**${catLabel}**) பொருத்தமான திட்டங்கள்:\n\n`, `Neenga sonnadhu vechi (**${catLabel}**) indha schemes best:\n\n`)
        + schemeLines(cat, lang, 4) + T(lang, "\n\nFor a personalised list, open the **Scheme Finder** on the Schemes page. Confirm on the official portal before applying.", "\n\nஉங்களுக்கென பட்டியல் பெற **திட்ட கண்டுபிடிப்பான்**-ஐ பயன்படுத்துங்கள்.", "\n\nPersonal list ku **Scheme Finder** use pannunga.");
      break;
    case "rights": {
      const laws = lawsFor(cat).length ? lawsFor(cat) : kb.laws.slice(0, 2);
      text = T(lang, "You have real legal protection here:\n\n", "உங்களுக்கு சட்டப் பாதுகாப்பு உள்ளது:\n\n", "Ungalukku legal protection irukku:\n\n")
        + laws.slice(0, 2).map((l) => `**${lang === "ta" ? l.name_ta : l.name}**\n${lang === "ta" ? l.summary_ta : l.summary}\n${l.your_rights.slice(0, 3).map((r) => `  - ${r}`).join("\n")}\n  What to do: ${l.how_to_act}`).join("\n\n")
        + T(lang, "\n\nFree legal help: **DLSA 15100**. This is general information, not legal advice.", "\n\nஇலவச சட்ட உதவி: **15100**.", "\n\nFree legal help: **15100**.");
      break;
    }
    case "interest": {
      const r = parseRate(ctx.message);
      if (r) {
        const n = { day: 365, week: 52, month: 12, year: 1 }[r[1]]!;
        const simple = r[0] * n, comp = (Math.pow(1 + r[0] / 100, n) - 1) * 100;
        const ct = comp < 10000 ? `${Math.round(comp).toLocaleString("en-IN")}%` : "over 10,000%";
        text = T(lang,
          `**${r[0]}% per ${r[1]}** works out to **${simple.toLocaleString("en-IN")}% a year** (simple), or **${ct}** if interest is added to the balance.\n\nFor comparison: an SHG loan is roughly 7–12%, a MUDRA loan about 9–12%, and a Kisan Credit Card ~4–7% a year.`,
          `**ஒரு ${r[1]}-க்கு ${r[0]}%** என்பது **ஆண்டுக்கு ${simple.toLocaleString("en-IN")}%**, கூட்டு வட்டியானால் **${ct}**.\n\nஒப்பீடு: SHG ~7–12%, முத்ரா ~9–12%, கிசான் கடன் அட்டை ~4–7%.`,
          `**${r[0]}% per ${r[1]}** na **varushathukku ${simple.toLocaleString("en-IN")}%**, compound aana **${ct}**.\n\nCompare: SHG ~7–12%, MUDRA ~9–12%, KCC ~4–7%.`);
        if (simple > 36) text += T(lang, " A rate this high from a private lender is very likely illegal under the **TN Prohibition of Charging Exorbitant Interest Act, 2003** — you can file a police complaint and get free legal help at **15100**.",
          " இவ்வளவு அதிக வட்டி **2003 அதிக வட்டி தடைச் சட்டத்தின்** கீழ் சட்டவிரோதமாக இருக்கலாம் — இலவச சட்ட உதவி **15100**.",
          " Ivlo vatti **TN Exorbitant Interest Act 2003** padi illegal ah irukka chance adhigam — free legal help **15100**.");
      } else {
        text = T(lang, "Tell me the rate and how often it's charged — e.g. *“10% per week”* — and I'll convert it to a yearly rate. The **Tools** page has a full interest calculator too.",
          "வட்டி விகிதத்தையும் எத்தனை நாளுக்கு ஒருமுறை என்பதையும் சொல்லுங்கள் — உதா: *“வாரம் 10%”*.", "Vatti rate um eppadi charge panraanga nu sollunga — eg *“10% per week”*.");
      }
      break;
    }
    case "budget": {
      const amts = parseAmounts(ctx.message);
      if (amts.length) {
        const inc = Math.max(...amts), f = (x: number) => "₹" + Math.round(x).toLocaleString("en-IN");
        text = T(lang,
          `Here's a starting plan for **${f(inc)}/month**:\n\n- Essentials (rent, food, power, medicine): **${f(inc * 0.5)}** (50%)\n- All loan repayments: keep under **${f(inc * 0.3)}** (30%)\n- Emergency savings: **${f(inc * 0.1)}** (10%) until you reach ${f(inc * 3)}\n- Everything else: the remaining 10%\n\nIf EMIs are above 40% of income, that's a debt-trap zone — ask lenders in writing for longer tenure. The **Budget Planner** in Tools uses your exact EMIs.`,
          `**மாதம் ${f(inc)}**-க்கு ஒரு தொடக்கத் திட்டம்:\n\n- அத்தியாவசியம்: **${f(inc * 0.5)}** (50%)\n- எல்லா கடன் தவணைகளும்: **${f(inc * 0.3)}**-க்குள் (30%)\n- அவசர சேமிப்பு: **${f(inc * 0.1)}** (10%)\n- மீதி: 10%`,
          `**Maasam ${f(inc)}** ku starting plan:\n\n- Essentials: **${f(inc * 0.5)}** (50%)\n- Ella loan EMI um: **${f(inc * 0.3)}** kulla (30%)\n- Emergency savings: **${f(inc * 0.1)}** (10%)\n- Meedhi: 10%`);
      } else {
        text = T(lang, "Happy to help with a budget. What's your monthly household income, and roughly how much goes to loan repayments each month?", "பட்ஜெட் போட உதவுகிறேன். மாத வருமானம் எவ்வளவு, கடன் தவணைக்கு மாதம் எவ்வளவு போகிறது?", "Budget podalaam. Unga maasa income evlo, loan EMI ku evlo pogudhu?");
      }
      break;
    }
    default: {
      const seen = ctx.history.filter((m) => m.role === "assistant").map((m) => m.meta?.category);
      if (seen.includes(cat) && cat !== "general_financial_stress") {
        const law = lawsFor(cat)[0];
        text = T(lang, `I hear you — this ${catLabel} situation is still weighing on you. Let's go one level deeper.\n\n`, `புரிகிறது — இந்த ${catLabel} பிரச்சனை இன்னும் அழுத்துகிறது.\n\n`, `Puriyudhu — indha ${catLabel} problem innum tension kudukudhu.\n\n`)
          + (law ? `**${lang === "ta" ? law.name_ta : law.name}** — ${law.how_to_act}\n\n` : "") + schemeLines(cat, lang, 2)
          + T(lang, "\n\nTo give you a sharper plan: how much do you owe in total, and what do you earn each month?", "\n\nமொத்தக் கடன் எவ்வளவு, மாத வருமானம் எவ்வளவு?", "\n\nTotal kadan evlo, maasa varumaanam evlo?");
      } else {
        text = compose(cat, a.stress_label, lang);
        const r = parseRate(ctx.message);
        if (r) {
          const yearly = r[0] * { day: 365, week: 52, month: 12, year: 1 }[r[1]]!;
          const ill = yearly > 36;
          text += T(lang,
            `\n\n**${r[0]}% per ${r[1]} = ${yearly.toLocaleString("en-IN")}% a year.**${ill ? " A private lender charging this is very likely breaking the TN Prohibition of Charging Exorbitant Interest Act, 2003." : ""}`,
            `\n\n**ஒரு ${r[1]}-க்கு ${r[0]}% = ஆண்டுக்கு ${yearly.toLocaleString("en-IN")}%.**${ill ? " இது 2003 அதிக வட்டி தடைச் சட்டத்தின் கீழ் சட்டவிரோதமாக இருக்கலாம்." : ""}`,
            `\n\n**${r[0]}% per ${r[1]} = varushathukku ${yearly.toLocaleString("en-IN")}%.**${ill ? " Idhu TN Exorbitant Interest Act 2003 padi illegal ah irukka chance adhigam." : ""}`);
        }
        if (a.crisis.level === "severe") text += T(lang, "\n\nThreats or harassment are crimes. If you feel unsafe, call **100 / 112**; for loan-app threats call **1930**.", "\n\nமிரட்டல் குற்றம். **100 / 112**; கடன் செயலி மிரட்டலுக்கு **1930**.", "\n\nMirattal oru crime. **100 / 112**; loan app threat ku **1930**.");
        if (ctx.district && lang !== "ta") text += `\n\nYour nearest free legal-aid office is the **${ctx.district} District Legal Services Authority** (call 15100).`;
        text += T(lang, "\n\nCan you tell me a bit more — roughly how much you owe and to whom?", "\n\nஇன்னும் கொஞ்சம் சொல்லுங்கள் — யாரிடம், எவ்வளவு கடன்?", "\n\nKonjam detail ah sollunga — yaar kitta, evlo kadan?");
      }
      intent = "distress";
    }
  }
  // closing line for distress replies (mirrors the L6 tone refiner)
  if (intent === "distress") text += "\n\n" + T(lang, "You are not alone in this — we can take it one step at a time. வழி இருக்கிறது.", "நீங்கள் தனியாக இல்லை — ஒவ்வொரு படியாக முன்னேறுவோம். வழி இருக்கிறது.", "Neenga thaniya illa — onnu onna paarthukalaam. Vazhi irukku.");
  return { text, intent, hits };
}
