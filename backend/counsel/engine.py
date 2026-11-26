"""
VazhiAPI Chat Engine
====================
Two interchangeable counsellors behind one streaming interface:

  • ClaudeCounsellor — Claude (claude-opus-5-5) with a stable, cached system prompt, the
    pipeline analysis + retrieved Tamil Nadu knowledge injected per turn, and server-side
    refusal fallbacks. Used when Anthropic credentials are configured.
  • LocalCounsellor  — deterministic bilingual engine (intent detection + knowledge base +
    conversation memory). Always available; also the fallback if Claude errors.

Safety rules (crisis helplines) are enforced outside the model in both paths.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import AsyncIterator

from core.config import get_settings
from models.seq2seq_generator import compose_response
from tn_context import knowledge

log = logging.getLogger("vazhi")
settings = get_settings()


@dataclass
class ChatContext:
    message: str
    language: str                      # en | ta | tanglish
    analysis: dict                     # pipeline result for this message
    history: list[dict] = field(default_factory=list)   # [{"role","content","meta"}] oldest→newest, excl. current
    user_name: str | None = None
    district: str | None = None
    kb_hits: list[dict] | None = None   # knowledge-base retrieval for this message


# ───────────────────────────── intents ─────────────────────────────

INTENTS: list[tuple[str, list[str]]] = [
    ("human", ["talk to a human", "real person", "counsellor", "counselor", "call me", "human support",
               "aalu kitta pesanum", "நபரிடம் பேச", "ஆலோசகர்"]),
    ("helpline", ["helpline", "phone number", "contact number", "who can i call", "number to call",
                  "உதவி எண்", "help number"]),
    ("scheme", ["scheme", "schemes", "government help", "govt", "subsidy", "yojana", "thittam", "திட்டம்",
                "eligible", "apply for"]),
    ("rights", ["legal", "law", "rights", "police", "complaint", "court", "illegal", "sattam", "சட்டம்",
                "உரிமை", "புகார்"]),
    ("interest", ["interest rate", "how much interest", "per day", "per week", "per month", "percent", "%",
                  "apr", "vatti evlo", "வட்டி எவ்வளவு"]),
    ("budget", ["budget", "salary", "income", "save money", "savings", "monthly expenses", "plan my",
                "சம்பளம்", "சேமிப்பு", "பட்ஜெட்"]),
    ("about", ["what can you do", "who are you", "what is vazhi", "what is vazhiapi", "how can you help", "what do you do",
               "nee yaar", "neenga yaar", "நீங்கள் யார்", "என்ன செய்ய முடியும்"]),
    ("thanks", ["thank", "thanks", "nandri", "நன்றி", "helpful"]),
    ("greeting", ["hi", "hello", "hey", "vanakkam", "வணக்கம்", "good morning", "good evening"]),
]


def _has(text: str, phrase: str) -> bool:
    if re.search(r"[஀-௿%]", phrase):
        return phrase in text
    return re.search(rf"(?<![a-z]){re.escape(phrase)}(?![a-z])", text) is not None


FAQ_MIN_SCORE = 5.0   # retrieval confidence needed to answer from the knowledge base


def detect_intent(message: str, analysis: dict, kb_hits: list[dict] | None = None) -> str:
    t = message.lower().strip()
    if analysis["crisis"]["level"] == "critical":
        return "crisis"
    hits = [name for name, phrases in INTENTS if any(_has(t, p) for p in phrases)]
    words = len(t.split())
    if "greeting" in hits and words <= 4 and not analysis["detected_keywords"]:
        return "greeting"
    if "thanks" in hits and words <= 8 and not analysis["detected_keywords"]:
        return "thanks"
    for name in ("human", "helpline", "about"):
        if name in hits:
            return name
    calm = analysis["stress_score"] < 55 and analysis["crisis"]["level"] == "low"
    if "interest" in hits and _parse_rate(message) and calm:
        return "interest"
    if "budget" in hits and _parse_amounts(message):
        return "budget"
    if kb_hits and kb_hits[0]["kind"] == "faq" and kb_hits[0]["score"] >= FAQ_MIN_SCORE:
        return "faq"
    for name in ("scheme", "rights") + (("interest", "budget") if calm else ()):
        if name in hits:
            return name
    if (not analysis["detected_keywords"] and analysis["debt_category"] == "general_financial_stress"
            and analysis["stress_score"] < 45 and words >= 3
            and not any(h["kind"] == "faq" and h["score"] >= FAQ_MIN_SCORE * 0.6 for h in (kb_hits or []))):
        return "general"
    return "distress"


# ─────────────────────── follow-up suggestions ───────────────────────

SUGGESTIONS = {
    "en": {
        "schemes": "Which government schemes can help me?",
        "rights": "What are my legal rights?",
        "interest": "Calculate the real interest I'm paying",
        "budget": "Help me make a monthly budget",
        "helpline": "Who can I call right now?",
        "human": "I want to talk to a human counsellor",
        "steps": "What should I do first?",
    },
    "ta": {
        "schemes": "எந்த அரசு திட்டங்கள் உதவும்?",
        "rights": "என் சட்ட உரிமைகள் என்ன?",
        "interest": "நான் கட்டும் உண்மையான வட்டி எவ்வளவு?",
        "budget": "மாத பட்ஜெட் போட உதவுங்கள்",
        "helpline": "இப்போது யாரை அழைக்கலாம்?",
        "human": "ஆலோசகரிடம் பேச வேண்டும்",
        "steps": "முதலில் என்ன செய்ய வேண்டும்?",
    },
}


def suggestions_for(intent: str, analysis: dict, lang: str) -> list[str]:
    s = SUGGESTIONS["ta" if lang == "ta" else "en"]
    cat = analysis["debt_category"]
    if intent == "crisis":
        keys = ["helpline", "human", "steps"]
    elif intent in ("greeting", "thanks", "general"):
        keys = ["steps", "schemes", "budget"]
    elif intent == "scheme":
        keys = ["rights", "budget", "human"]
    elif intent == "rights":
        keys = ["schemes", "helpline", "steps"]
    elif intent == "interest":
        keys = ["rights", "schemes", "budget"]
    elif intent == "budget":
        keys = ["schemes", "interest", "steps"]
    else:
        keys = ["schemes", "rights"]
        keys.append("interest" if cat in ("blade_finance", "microfinance_debt", "loan_app_harassment",
                                          "credit_card_debt", "gold_loan_overdue") else "budget")
        if analysis["stress_score"] >= 70:
            keys = ["helpline", "human"] + keys[:1]
    return [s[k] for k in keys]


# ─────────────────────────── local engine ───────────────────────────

def _t(lang: str, en: str, ta: str, tl: str | None = None) -> str:
    return ta if lang == "ta" else (tl or en) if lang == "tanglish" else en


def _parse_rate(text: str) -> tuple[float, str] | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\s*(?:interest\s*)?(?:per|a|every|/)?\s*(day|daily|week|weekly|month|monthly|year|annum)",
                  text.lower())
    if not m:
        return None
    unit = m.group(2)
    unit = "day" if unit.startswith("da") else "week" if unit.startswith("week") else \
        "month" if unit.startswith("month") else "year"
    return float(m.group(1)), unit


def _parse_amounts(text: str) -> list[float]:
    vals = []
    for num, unit in re.findall(r"(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(lakh|lakhs|k|thousand)?", text.lower()):
        v = float(num.replace(",", ""))
        if unit and unit.startswith("lakh"):
            v *= 100000
        elif unit in ("k", "thousand"):
            v *= 1000
        if v >= 100:
            vals.append(v)
    return vals


def _scheme_lines(cat: str, lang: str, n: int = 3) -> str:
    lines = []
    for s in knowledge.schemes_for(cat, limit=n):
        name = s["name_ta"] if lang == "ta" else s["name"]
        desc = s["description_ta"] if lang == "ta" else s["benefit"]
        lines.append(f"- **{name}** — {desc}  \n  📞 {s['helpline']} · {s['application_url']}")
    return "\n".join(lines)


def _helpline_lines(tags: list[str], n: int = 4) -> str:
    return "\n".join(f"- **{h['name']}** — 📞 **{h['number']}** ({h['hours']})" for h in knowledge.helplines_for(tags, n))


def _previous_categories(history: list[dict]) -> list[str]:
    return [m.get("meta", {}).get("category") for m in history if m.get("role") == "assistant" and m.get("meta")]


class LocalCounsellor:
    name = "vazhi-local"

    def reply(self, ctx: ChatContext) -> tuple[str, str]:
        a, lang = ctx.analysis, ctx.language
        cat = a["debt_category"]
        cat_info = knowledge.category_map()[cat]
        cat_label = cat_info["label_ta"] if lang == "ta" else cat_info["label"]
        kb_hits = ctx.kb_hits if ctx.kb_hits is not None else knowledge.search(ctx.message, 4)
        intent = detect_intent(ctx.message, a, kb_hits)
        name = (ctx.user_name or "").split(" ")[0]

        if intent == "crisis":
            text = _t(lang,
                      f"{name + ', ' if name else ''}I'm really glad you told me. What you're carrying right now is too much for anyone alone, and your life matters far more than any loan.\n\n"
                      "**Please reach out right now — it's free and confidential:**\n" + _helpline_lines(["crisis"], 3) +
                      "\n\nIf you are in immediate danger, call **112**.\n\nWhen you feel a little steadier, I'm here to work through the debt with you step by step — there *are* legal protections and schemes for exactly this situation. Would you like me to notify a human counsellor to contact you?",
                      f"{name + ', ' if name else ''}சொன்னதற்கு மிக்க நன்றி. நீங்கள் சுமக்கும் பாரம் யாருக்கும் தனியாக அதிகம் — எந்தக் கடனையும் விட உங்கள் உயிர் முக்கியம்.\n\n"
                      "**தயவுசெய்து இப்போதே அழையுங்கள் — இலவசம், ரகசியம்:**\n" + _helpline_lines(["crisis"], 3) +
                      "\n\nஉடனடி ஆபத்து என்றால் **112**-ஐ அழையுங்கள்.\n\nகொஞ்சம் அமைதியானதும், கடனை படிப்படியாக சேர்ந்து சமாளிப்போம் — இதற்கென சட்டப் பாதுகாப்பும் திட்டங்களும் உள்ளன. ஒரு ஆலோசகர் உங்களை தொடர்பு கொள்ள ஏற்பாடு செய்யட்டுமா?",
                      f"{name + ', ' if name else ''}sonnadhukku romba nandri. Neenga thaniya idha sumakka vendiyadhu illa — endha kadanum unga uyir vida periyadhu illa.\n\n"
                      "**Ippove call pannunga — free, confidential:**\n" + _helpline_lines(["crisis"], 3) +
                      "\n\nUdanadi aabathu na **112** ku call pannunga.\n\nKonjam calm aanadhum, kadanai step by step sendhu paarthukalaam. Oru human counsellor ungala contact panna arrange pannatuma?")
            return text, intent

        if intent == "greeting":
            text = _t(lang,
                      f"Vanakkam{' ' + name if name else ''}! 🙏 I'm Vazhi, your financial wellness companion. You can tell me about any money worry — a loan, a moneylender, a chit fund, an app that's harassing you — in English, Tamil or Tanglish. Everything here is confidential and judgement-free.\n\nWhat's on your mind today?",
                      f"வணக்கம்{' ' + name if name else ''}! 🙏 நான் வழி — உங்கள் நிதி நலத் துணை. கடன், வட்டிக்காரர், சீட்டு, மிரட்டும் கடன் செயலி — எதைப் பற்றியும் தமிழிலோ ஆங்கிலத்திலோ சொல்லலாம். எல்லாம் ரகசியம், யாரும் குறை சொல்ல மாட்டார்கள்.\n\nஇன்று உங்கள் மனதில் என்ன இருக்கிறது?",
                      f"Vanakkam{' ' + name if name else ''}! 🙏 Naan Vazhi — unga financial wellness companion. Kadan, vatti, seettu, loan app threat — edhu irundhaalum Tamil, English, Tanglish la sollunga. Ellame confidential.\n\nInniku enna vishayam?")
            return text, intent

        if intent == "thanks":
            text = _t(lang,
                      "You're welcome — and well done for taking these steps. Come back any time; I'll remember where we left off. Is there anything else worrying you?",
                      "நன்றி! இந்த முயற்சி எடுத்ததற்கு பாராட்டுகள். எப்போது வேண்டுமானாலும் வாருங்கள். வேறு ஏதாவது கவலை இருக்கிறதா?",
                      "Paravaillai! Indha step eduthadhukku hats off. Eppo venumnaalum vaanga. Vera edhaachum tension irukka?")
            return text, intent

        if intent == "human":
            text = _t(lang,
                      "Of course. Tap **“Talk to a counsellor”** below and I'll flag your conversation for a trained counsellor — they'll see only what you've shared here.\n\nIf you'd like to speak to someone right now:\n" + _helpline_lines(["stress", cat], 3),
                      "நிச்சயமாக. கீழே உள்ள **“ஆலோசகரிடம் பேசு”** பொத்தானை அழுத்துங்கள் — பயிற்சி பெற்ற ஆலோசகர் உங்களை தொடர்பு கொள்வார்.\n\nஇப்போதே பேச வேண்டுமென்றால்:\n" + _helpline_lines(["stress", cat], 3),
                      "Kandippa. Keezha irukura **“Talk to a counsellor”** button ah press pannunga — trained counsellor ungala contact pannuvaanga.\n\nIppove pesanum na:\n" + _helpline_lines(["stress", cat], 3))
            return text, intent

        if intent == "helpline":
            tags = [cat, "stress"] + (["threat"] if a["crisis"]["level"] == "severe" else [])
            text = _t(lang, "Here are the free numbers most relevant to your situation:\n\n",
                      "உங்கள் சூழலுக்கு பொருத்தமான இலவச எண்கள்:\n\n",
                      "Unga situation ku useful aana free numbers:\n\n") + _helpline_lines(tags, 5)
            return text, intent

        if intent == "about":
            about = next(e for e in knowledge.faq() if e["id"] == "what_is_vazhi")
            kb_hits = [{"kind": "faq", "id": about["id"], "title": about["q"][0], "score": 99.0, "item": about}]
            intent = "faq"

        if intent == "faq":
            top = kb_hits[0]
            parts = []
            if a["stress_score"] >= 55 and a["crisis"]["level"] != "low":
                parts.append(_t(lang, "That sounds stressful — let's take it one step at a time.",
                                "இது கஷ்டமான நிலை — ஒவ்வொரு படியாக பார்ப்போம்.",
                                "Idhu kashtamana nilamai — onnu onna paarpom."))
            if lang == "ta":
                parts.append("_(விரிவான தகவல் கீழே ஆங்கிலத்தில்)_")
            parts.append(top["item"]["a"])
            related = [h for h in kb_hits[1:] if h["kind"] == "faq" and h["score"] >= top["score"] * 0.55][:2]
            if related:
                parts.append(_t(lang, "Related: ", "தொடர்புடையவை: ", "Related: ") + " · ".join(f"*{h['title']}*" for h in related))
            if a["crisis"]["level"] == "severe":
                parts.append(_t(lang, "⚠️ Threats or harassment are crimes — call **100 / 112** if you feel unsafe.",
                                "⚠️ மிரட்டல் குற்றம் — பாதுகாப்பில்லை என்றால் **100 / 112**.",
                                "⚠️ Mirattal crime — safe ah illa na **100 / 112**."))
            return "\n\n".join(parts), intent

        if intent == "general":
            text = _t(lang,
                      "I'm best at **money, debt, rights and wellbeing questions for Tamil Nadu**, so I can't answer that one reliably here. "
                      "Here are things I can help with right away:\n- *“How can I improve my CIBIL score?”*\n- *“Someone took money from my UPI — what do I do?”*\n"
                      "- *“What documents do I need for government schemes?”*\n- *“Is 10% per week interest legal?”*\n\nOr just tell me what's worrying you.",
                      "நான் **பணம், கடன், உரிமைகள், நலம்** தொடர்பான கேள்விகளுக்கு சிறப்பாக உதவுவேன்; அந்தக் கேள்விக்கு இங்கே சரியான பதில் தர முடியாது. "
                      "இவற்றைக் கேளுங்கள்:\n- *“என் CIBIL ஸ்கோரை எப்படி உயர்த்துவது?”*\n- *“UPI மோசடியில் பணம் போனது — என்ன செய்வது?”*\n- *“அரசு திட்டங்களுக்கு என்ன ஆவணங்கள் வேண்டும்?”*",
                      "Naan **panam, kadan, urimai, wellbeing** questions la dhaan best ah help pannuven — andha question ku inga correct answer tharamudiyadhu. "
                      "Idha try pannunga:\n- *“CIBIL score epdi improve panradhu?”*\n- *“UPI fraud la panam pochu, enna pannanum?”*\n- *“Scheme ku enna documents venum?”*")
            return text, intent

        if intent == "scheme":
            lines = _scheme_lines(cat, lang, 4)
            text = _t(lang, f"Based on what you've shared (**{cat_label}**), these schemes are the best fit:\n\n",
                      f"நீங்கள் சொன்னதன் அடிப்படையில் (**{cat_label}**) பொருத்தமான திட்டங்கள்:\n\n",
                      f"Neenga sonnadhu vechi (**{cat_label}**) indha schemes best:\n\n") + lines + \
                _t(lang, "\n\nFor a personalised list, open **Scheme Finder** and answer 5 quick questions. Benefits change with government orders, so confirm on the official portal before applying.",
                   "\n\nஉங்களுக்கென பட்டியல் பெற **திட்ட கண்டுபிடிப்பான்**-ல் 5 கேள்விகளுக்கு பதில் சொல்லுங்கள். விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ தளத்தில் உறுதி செய்யுங்கள்.",
                   "\n\nPersonal list ku **Scheme Finder** la 5 questions ku answer pannunga. Apply pannradhuku munnadi official site la confirm pannunga.")
            return text, intent

        if intent == "rights":
            laws = knowledge.laws_for(cat) or knowledge.laws()[:2]
            blocks = []
            for law in laws[:2]:
                nm = law["name_ta"] if lang == "ta" else law["name"]
                summ = law["summary_ta"] if lang == "ta" else law["summary"]
                rights = "\n".join(f"  - {r}" for r in law["your_rights"][:3])
                blocks.append(f"**{nm}**\n{summ}\n{rights}\n  ➜ {law['how_to_act']}")
            text = _t(lang, "You have real legal protection here:\n\n", "உங்களுக்கு சட்டப் பாதுகாப்பு உள்ளது:\n\n",
                      "Ungalukku legal protection irukku:\n\n") + "\n\n".join(blocks) + \
                _t(lang, "\n\nFree legal help: **DLSA 15100**. This is general information, not legal advice for your specific case.",
                   "\n\nஇலவச சட்ட உதவி: **15100**. இது பொதுத் தகவல், உங்கள் வழக்குக்கான சட்ட ஆலோசனை அல்ல.",
                   "\n\nFree legal help: **15100**. Idhu general information dhaan, legal advice illa.")
            return text, intent

        if intent == "interest":
            rate = _parse_rate(ctx.message)
            if rate:
                r, unit = rate
                periods = {"day": 365, "week": 52, "month": 12, "year": 1}[unit]
                simple = r * periods
                compound = ((1 + r / 100) ** periods - 1) * 100
                comp_txt = f"{compound:,.0f}%" if compound < 10000 else "over 10,000%"
                comp_txt = f"{compound:,.0f}%" if compound < 10000 else "over 10,000%"
                text = _t(lang,
                          f"**{r:g}% per {unit}** works out to **{simple:,.0f}% a year** (simple), or **{comp_txt}** if interest is added to the balance.\n\nFor comparison: an SHG loan is roughly 7–12%, a MUDRA loan about 9–12%, and a Kisan Credit Card ~4–7% a year. ",
                          f"**ஒரு {unit}-க்கு {r:g}%** என்பது **ஆண்டுக்கு {simple:,.0f}%** (சாதாரண வட்டி), கூட்டு வட்டியானால் **{comp_txt}**.\n\nஒப்பீடு: SHG கடன் ~7–12%, முத்ரா ~9–12%, கிசான் கடன் அட்டை ~4–7%. ",
                          f"**{r:g}% per {unit}** na **varushathukku {simple:,.0f}%** (simple), compound aana **{comp_txt}**.\n\nCompare: SHG loan ~7–12%, MUDRA ~9–12%, KCC ~4–7%. ")
                if simple > 36:
                    text += _t(lang, "A rate this high from a private lender is very likely illegal under the **TN Prohibition of Charging Exorbitant Interest Act, 2003** — you can file a police complaint and get free legal help at **15100**.",
                               "இவ்வளவு அதிக வட்டி **2003 அதிக வட்டி தடைச் சட்டத்தின்** கீழ் சட்டவிரோதமாக இருக்கலாம் — காவல் நிலையத்தில் புகார் செய்யலாம், இலவச சட்ட உதவி **15100**.",
                               "Ivlo vatti **TN Exorbitant Interest Act 2003** padi illegal ah irukka chance adhigam — police complaint kudukalaam, free legal help **15100**.")
            else:
                text = _t(lang, "Tell me the rate and how often it's charged — e.g. *“10% per week”* or *“₹10 per ₹100 per day”* — and I'll convert it to a yearly rate. You can also use the **Interest Calculator** in Tools.",
                          "வட்டி விகிதத்தையும் எத்தனை நாளுக்கு ஒருமுறை என்பதையும் சொல்லுங்கள் — உதா: *“வாரம் 10%”* — ஆண்டு வட்டியாக மாற்றித் தருகிறேன்.",
                          "Vatti rate um eppadi charge panraanga nu sollunga — eg *“10% per week”* — yearly rate ah convert panni tharen.")
            return text, intent

        if intent == "budget":
            amts = _parse_amounts(ctx.message)
            if amts:
                income = max(amts)
                needs, debt_cap, save = income * 0.5, income * 0.3, income * 0.1
                text = _t(lang,
                          f"Here's a starting plan for **₹{income:,.0f}/month**:\n\n- Essentials (rent, food, power, medicine): **₹{needs:,.0f}** (50%)\n- All loan repayments: keep under **₹{debt_cap:,.0f}** (30%)\n- Emergency savings: **₹{save:,.0f}** (10%) until you reach ₹{income*3:,.0f}\n- Everything else: the remaining 10%\n\nIf your EMIs are above 40% of income, that's a debt-trap zone — ask lenders in writing for longer tenure, and move high-interest loans to SHG/MUDRA credit. The **Budget Planner** in Tools can do this with your exact EMIs.",
                          f"**மாதம் ₹{income:,.0f}**-க்கு ஒரு தொடக்கத் திட்டம்:\n\n- அத்தியாவசியம் (வாடகை, உணவு, மின்சாரம், மருந்து): **₹{needs:,.0f}** (50%)\n- எல்லா கடன் தவணைகளும்: **₹{debt_cap:,.0f}**-க்குள் (30%)\n- அவசர சேமிப்பு: **₹{save:,.0f}** (10%)\n- மீதி: 10%\n\nEMI வருமானத்தில் 40%-ஐ தாண்டினால் கடன் வலை — கடன் காலத்தை நீட்டிக்க எழுத்துமூலம் கேளுங்கள்.",
                          f"**Maasam ₹{income:,.0f}** ku starting plan:\n\n- Essentials: **₹{needs:,.0f}** (50%)\n- Ella loan EMI um: **₹{debt_cap:,.0f}** kulla (30%)\n- Emergency savings: **₹{save:,.0f}** (10%)\n- Meedhi: 10%\n\nEMI income la 40% mela na debt trap — lender kitta tenure extend panna letter kudunga.")
            else:
                text = _t(lang, "Happy to help with a budget. What's your monthly household income, and roughly how much goes to loan repayments each month?",
                          "பட்ஜெட் போட உதவுகிறேன். உங்கள் குடும்பத்தின் மாத வருமானம் எவ்வளவு, கடன் தவணைக்கு மாதம் எவ்வளவு போகிறது?",
                          "Budget podalaam. Unga maasa income evlo, loan EMI ku evlo pogudhu?")
            return text, intent

        # distress — conversation-aware: don't repeat the same first-steps answer twice
        seen = _previous_categories(ctx.history)
        if cat in seen and cat != "general_financial_stress":
            text = _t(lang,
                      f"I hear you — this {cat_label} situation is still weighing on you. Let's go one level deeper.\n\n",
                      f"புரிகிறது — இந்த {cat_label} பிரச்சனை இன்னும் அழுத்துகிறது. இன்னும் ஆழமாகப் பார்ப்போம்.\n\n",
                      f"Puriyudhu — indha {cat_label} problem innum tension kudukudhu. Innum deep ah paarpom.\n\n")
            laws = knowledge.laws_for(cat)
            if laws:
                text += f"**{laws[0]['name_ta'] if lang == 'ta' else laws[0]['name']}** — {laws[0]['how_to_act']}\n\n"
            text += _scheme_lines(cat, lang, 2)
            text += _t(lang, "\n\nTo give you a sharper plan: how much do you owe in total, and what do you earn each month?",
                       "\n\nதுல்லியமான திட்டத்திற்கு: மொத்தக் கடன் எவ்வளவு, மாத வருமானம் எவ்வளவு?",
                       "\n\nCorrect plan ku: total kadan evlo, maasa varumaanam evlo?")
            return text, intent

        text = compose_response(cat, a["stress_label"], lang)
        rate = _parse_rate(ctx.message)
        if rate:   # distress message that also quotes a rate: add the yearly-rate reality check
            r, unit = rate
            yearly = r * {"day": 365, "week": 52, "month": 12, "year": 1}[unit]
            text += _t(lang,
                       f"\n\n**{r:g}% per {unit} = {yearly:,.0f}% a year.**" + (" A private lender charging this is very likely breaking the TN Prohibition of Charging Exorbitant Interest Act, 2003." if yearly > 36 else ""),
                       f"\n\n**ஒரு {unit}-க்கு {r:g}% = ஆண்டுக்கு {yearly:,.0f}%.**" + (" இது 2003 அதிக வட்டி தடைச் சட்டத்தின் கீழ் சட்டவிரோதமாக இருக்கலாம்." if yearly > 36 else ""),
                       f"\n\n**{r:g}% per {unit} = varushathukku {yearly:,.0f}%.**" + (" Idhu TN Exorbitant Interest Act 2003 padi illegal ah irukka chance adhigam." if yearly > 36 else ""))
        if a["crisis"]["level"] == "severe":
            text += _t(lang, "\n\n⚠️ Threats or harassment are crimes. If you feel unsafe, call **100 / 112**; for loan-app threats call **1930**.",
                       "\n\n⚠️ மிரட்டல் குற்றம். பாதுகாப்பில்லை என்றால் **100 / 112**; கடன் செயலி மிரட்டலுக்கு **1930**.",
                       "\n\n⚠️ Mirattal oru crime. Safe ah illa na **100 / 112**; loan app threat ku **1930**.")
        if ctx.district and lang != "ta":
            text += f"\n\nYour nearest free legal-aid office is the **{ctx.district} District Legal Services Authority** (call 15100)."
        text += _t(lang, "\n\nCan you tell me a bit more — roughly how much you owe and to whom? That helps me make the plan specific.",
                   "\n\nஇன்னும் கொஞ்சம் சொல்லுங்கள் — யாரிடம், எவ்வளவு கடன்? திட்டத்தை துல்லியமாக்க உதவும்.",
                   "\n\nKonjam detail ah sollunga — yaar kitta, evlo kadan? Plan ah specific ah panna help aagum.")
        return text, intent


# ─────────────────────────── Claude engine ───────────────────────────

SYSTEM_PROMPT = """You are **Vazhi** (வழி, "the way"), a warm, practical financial-wellness counsellor for people in Tamil Nadu, India, inside the VazhiAPI app. People come to you stressed about debt: kandhu/meter vatti (blade finance), chit funds, gold loans, farm debt, wedding and festival debt, microfinance group loans, harassing loan apps, medical bills, education loans and credit cards.

How you respond:
- Reply in the user's language: Tamil script if they write Tamil, Tanglish (romanised Tamil mixed with English) if they write Tanglish, otherwise English. Keep Tamil simple and spoken, not formal.
- Be shame-free. Debt traps are systemic; never imply the person is foolish or irresponsible.
- Be concise and concrete: 80–220 words. Use short paragraphs and at most one short list. Use **bold** sparingly for key numbers and next steps. Markdown is rendered.
- Give one to three specific next steps the person can do this week. Prefer the schemes, laws and helplines provided in the <context> block — they are verified for Tamil Nadu. Never invent phone numbers, URLs, scheme names or benefit amounts; if something isn't in the context and you aren't sure, say they should confirm with DLSA (15100) or the official portal.
- Ask at most one follow-up question when you need details (amount owed, interest rate, income, who the lender is).
- Use the conversation history: don't repeat advice you already gave; build on it.
- You are not a lawyer or doctor. For legal action, point to free legal aid (DLSA, 15100).
- People may also ask about anything else — general knowledge, studies, work, health, technology, daily life. Answer those helpfully and accurately too, in the same warm, concise style; if a question connects to their money situation, mention that briefly. Decline only what would be harmful.
- The <context> block may include "Knowledge base matches" — verified answers from VazhiAPI's Tamil Nadu dataset. Prefer them for facts about schemes, laws, procedures and helplines.

Safety (overrides everything else):
- If the person mentions suicide, self-harm, or not wanting to live, respond with warmth first, tell them their life matters more than any debt, and give Tele-MANAS 14416 (24×7, Tamil available) and emergency 112 before anything about money. Encourage them to talk to someone now.
- If they are being threatened, beaten, or harassed, say clearly that this is a crime and give 100/112 (and 1930 for loan-app/cyber threats).
- Never help with anything that would put them at risk (e.g. borrowing from another illegal lender to repay one)."""


def _context_block(ctx: ChatContext) -> str:
    a = ctx.analysis
    cat = knowledge.category_map()[a["debt_category"]]
    schemes = knowledge.schemes_for(a["debt_category"], limit=4)
    laws = knowledge.laws_for(a["debt_category"])[:2]
    tags = [a["debt_category"], "stress"] + (["crisis"] if a["crisis"]["level"] == "critical" else []) + \
           (["threat"] if a["crisis"]["level"] == "severe" else [])
    lines = [
        "<context>",
        f"User: {ctx.user_name or 'unknown'}; district: {ctx.district or 'unknown'}; reply language: {ctx.language}",
        f"Analysis of this message — stress {a['stress_score']}/100 ({a['stress_label']}); crisis level: {a['crisis']['level']}; "
        f"category: {cat['label']} (confidence {a['debt_category_probabilities'].get(a['debt_category'], 0):.0%}); "
        f"trajectory: {a['crisis_trajectory']}; recommended strategy: {a['rl_action_label']}",
        f"Category facts: {cat['description']} Legal status: {cat['legal_status']}",
        "First steps: " + " | ".join(cat.get("first_steps", [])),
        "Relevant schemes:",
        *[f"- {s['name']}: {s['benefit']}. Helpline {s['helpline']}, {s['application_url']}" for s in schemes],
        "Relevant laws:",
        *[f"- {l['name']}: {l['summary']} How to act: {l['how_to_act']}" for l in laws],
        "Helplines:",
        *[f"- {h['name']}: {h['number']} ({h['hours']})" for h in knowledge.helplines_for(tags, 5)],
        "Knowledge base matches for this message:",
        *[f"- [{h['kind']}] {h['title']}: {(h['item'].get('a') or h['item'].get('summary') or h['item'].get('description') or '')[:900]}"
          for h in (ctx.kb_hits or []) if h["score"] >= 2.5][:3],
        "</context>",
    ]
    return "\n".join(lines)


def claude_available() -> bool:
    mode = settings.CHAT_LLM.lower()
    if mode == "local":
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    if mode == "anthropic":
        return True
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


class ClaudeCounsellor:
    name = "claude"
    _client = None

    @classmethod
    def client(cls):
        if cls._client is None:
            import anthropic
            cls._client = anthropic.AsyncAnthropic(timeout=60.0, max_retries=2)
        return cls._client

    def _messages(self, ctx: ChatContext) -> list[dict]:
        msgs: list[dict] = []
        for m in ctx.history[-settings.CHAT_HISTORY_TURNS:]:
            role = "assistant" if m["role"] == "assistant" else "user"
            if msgs and msgs[-1]["role"] == role:          # API requires alternation
                msgs[-1]["content"] += "\n\n" + m["content"]
            else:
                msgs.append({"role": role, "content": m["content"]})
        while msgs and msgs[0]["role"] != "user":
            msgs.pop(0)
        current = f"{_context_block(ctx)}\n\n{ctx.message}"
        if msgs and msgs[-1]["role"] == "user":
            msgs[-1]["content"] += "\n\n" + current
        else:
            msgs.append({"role": "user", "content": current})
        return msgs

    async def stream(self, ctx: ChatContext) -> AsyncIterator[str]:
        async with self.client().beta.messages.stream(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            messages=self._messages(ctx),
            output_config={"effort": "low"},           # conversational replies; thinking stays adaptive
            cache_control={"type": "ephemeral"},       # cache system prompt + stable history prefix
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",                       # re-run on a fallback model if a classifier declines
        ) as stream:
            async for text in stream.text_stream:
                yield text
            final = await stream.get_final_message()
            if final.stop_reason == "refusal":
                raise RuntimeError("claude_refusal")


# ─────────────────────────── façade ───────────────────────────

async def generate_reply(ctx: ChatContext) -> AsyncIterator[tuple[str, str]]:
    """
    Yields ("delta", text) chunks, then a final ("meta", json-able info) is returned via
    the `info` dict on the generator object. Falls back to the local engine on any Claude error.
    """
    if ctx.kb_hits is None:
        ctx.kb_hits = knowledge.search(ctx.message, 4)
    intent = detect_intent(ctx.message, ctx.analysis, ctx.kb_hits)
    if claude_available():
        produced = False
        try:
            async for chunk in ClaudeCounsellor().stream(ctx):
                produced = True
                yield "delta", chunk
            yield "engine", ClaudeCounsellor.name
            yield "intent", intent
            return
        except Exception as exc:
            log.warning("Claude chat failed (%s) — falling back to local engine", type(exc).__name__)
            if produced:
                yield "delta", "\n\n"
    text, intent = LocalCounsellor().reply(ctx)
    # Stream the local reply in small word groups so the UI feels the same.
    words = re.split(r"(\s+)", text)
    buf = ""
    for w in words:
        buf += w
        if len(buf) >= 24:
            yield "delta", buf
            buf = ""
    if buf:
        yield "delta", buf
    yield "engine", LocalCounsellor.name
    yield "intent", intent
