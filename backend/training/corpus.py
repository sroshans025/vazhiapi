"""
VazhiAPI Distress Corpus generator
==================================
Builds a labelled, trilingual (English / Tamil / Tanglish) corpus of financial-distress
messages for the 12 Tamil Nadu debt categories, each with a stress score (0-100).

Real-world counselling transcripts are confidential, so the corpus is composed from
hand-written situation fragments × severity framings × speaker contexts. It's written to
datasets/vazhi_distress_corpus.jsonl and used by training/train_lite.py.

Run:  python -m training.corpus
"""
from __future__ import annotations

import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "datasets" / "vazhi_distress_corpus.jsonl"

# Situation fragments per category — en / ta / tanglish
SITUATIONS: dict[str, dict[str, list[str]]] = {
    "blade_finance": {
        "en": ["I borrowed {amt} from a local moneylender at 10% interest every week",
               "the blade finance man collects {small} daily from my shop",
               "I took kandhu vatti loan and the interest is more than the principal now",
               "meter vatti lender doubled my loan in two months",
               "the moneylender took my house papers as security for {amt}",
               "I pay daily vatti of {small} and still owe {amt}"],
        "ta": ["கந்து வட்டிக்கு {amt} வாங்கினேன், வாரம் 10% வட்டி",
               "மீட்டர் வட்டி கொடுப்பவர் தினமும் கடைக்கு வந்து வசூல் செய்கிறார்",
               "வட்டி அசலை விட அதிகமாகிவிட்டது",
               "வீட்டு பத்திரத்தை வட்டிக்காரர் வைத்துக்கொண்டார்"],
        "tanglish": ["kandhu vatti la {amt} vaanginen, vaaram 10% vatti",
                     "daily vatti katta mudiyala, collection aalu kadaikku varaan",
                     "meter vatti romba aagiduchu, asal vida vatti adhigam",
                     "vatti kaaran veetu pathiram vechirukaan"],
    },
    "chit_fund_default": {
        "en": ["the chit fund company closed and the foreman ran away with our money",
               "I took the chit prize early and now cannot pay the monthly chit instalment",
               "our seettu organiser disappeared with {amt} of members money",
               "chit fund is not giving my prize amount even after 3 months"],
        "ta": ["சீட்டு நடத்தியவர் பணத்துடன் ஓடிவிட்டார்", "சீட்டு எடுத்த பிறகு மாத தவணை கட்ட முடியவில்லை",
               "ஏலச்சீட்டு பணம் இன்னும் கொடுக்கவில்லை"],
        "tanglish": ["seettu nadathunavan panathoda odittaan", "seettu eduthutten, ippo monthly katta mudiyala",
                     "chit company close panniduchu, en panam {amt} pochu"],
    },
    "gold_loan_overdue": {
        "en": ["my gold loan is overdue and the bank sent an auction notice",
               "I pledged my wife's jewels for {amt} and cannot renew the gold loan",
               "the pawn shop says they will sell my chain next week",
               "NBFC gold loan interest keeps growing and they threaten auction"],
        "ta": ["நகை அடமானக் கடன் தவணை தாண்டிவிட்டது, ஏல நோட்டீஸ் வந்தது",
               "மனைவியின் நகையை அடகு வைத்தேன், மீட்க முடியவில்லை", "அடகுக் கடையில் செயினை விற்பதாக சொல்கிறார்கள்"],
        "tanglish": ["nagai adagu vechen, auction notice vandhuduchu", "gold loan renew panna panam illa",
                     "adagu kadai la chain ah vithuduvanganu solraanga"],
    },
    "agricultural_debt": {
        "en": ["my paddy crop failed because of drought and the crop loan is due",
               "the flood destroyed my banana farm and I owe {amt} to the cooperative bank",
               "I borrowed for fertilizer and seeds but the harvest price crashed",
               "tractor loan EMI is pending after two bad monsoons"],
        "ta": ["வறட்சியால் நெல் பயிர் கருகிவிட்டது, பயிர்க் கடன் கட்ட வேண்டும்",
               "வெள்ளத்தில் வாழைத் தோட்டம் அழிந்தது", "உரம் விதைக்கு கடன் வாங்கினேன், விலை சரிந்தது"],
        "tanglish": ["mazhai illama nel payir pochu, crop loan katta mudiyala",
                     "vellathula vaazha thottam azhinjiduchu", "uram vidhaikku kadan vaanginen, vilai kammi aagiduchu"],
    },
    "wedding_debt": {
        "en": ["I borrowed {amt} from many people for my daughter's wedding",
               "the groom's family wants more dowry and I already have wedding loans",
               "marriage hall and jewellery loans are pending since my sister's wedding",
               "we spent everything on the wedding ceremony and now owe several lenders"],
        "ta": ["மகளின் திருமணத்திற்கு பலரிடம் கடன் வாங்கினேன்", "வரதட்சணை இன்னும் கேட்கிறார்கள்",
               "கல்யாண மண்டபம், நகைக்கு வாங்கிய கடன் இன்னும் இருக்கு"],
        "tanglish": ["ponnu kalyanathukku {amt} kadan vaanginen", "seer innum kekkuraanga, kalyanam kadan irukku",
                     "thangachi kalyanam kadan innum mudiyala"],
    },
    "festival_credit": {
        "en": ["I took small loans for Deepavali clothes and crackers and they keep adding up",
               "every Pongal I borrow for gifts and new clothes and never finish paying",
               "used pay later for festival shopping and now the dues are piling up",
               "temple festival expenses made me borrow {small} again this year"],
        "ta": ["தீபாவளி துணிக்கு கடன் வாங்கினேன்", "ஒவ்வொரு பொங்கலுக்கும் கடன் வாங்குகிறேன்",
               "திருவிழா செலவுக்கு மீண்டும் கடன்"],
        "tanglish": ["deepavali dress ku kadan vaanginen", "ovvoru pongal kum kadan vaanguren",
                     "thiruvizha selavukku thirumba kadan"],
    },
    "microfinance_debt": {
        "en": ["I have four microfinance group loans and pay weekly to each",
               "took a new MFI loan to repay the old group loan",
               "the microfinance collection agent shouts at our center meeting",
               "group members pressure me because I missed the weekly instalment"],
        "ta": ["நான்கு மைக்ரோஃபைனான்ஸ் குழு கடன்கள், வாரம் தவணை", "பழைய குழு கடனை அடைக்க புதிய கடன் வாங்கினேன்",
               "மகளிர் குழு கடன் வார தவணை கட்ட முடியவில்லை"],
        "tanglish": ["naalu microfinance group loan irukku, vaaram katanum", "pazhaya group loan ku pudhu loan vaanginen",
                     "magalir group loan vaara thavanai katta mudiyala"],
    },
    "loan_app_harassment": {
        "en": ["an instant loan app is calling my contacts and sending morphed photos",
               "the loan app took a huge processing fee and now threatens me on WhatsApp",
               "I borrowed {small} from an online loan app and they are messaging my relatives",
               "7 day loan app keeps increasing the amount and harassing my family"],
        "ta": ["கடன் செயலி என் தொடர்புகளுக்கு அழைத்து மிரட்டுகிறது", "ஆன்லைன் கடன் ஆப் புகைப்படத்தை மாற்றி அனுப்புகிறார்கள்"],
        "tanglish": ["loan app en contacts ku call panni mirattuthu", "online loan app la {small} eduthen, relatives ku message panraanga",
                     "app loan kaaranga whatsapp la threat panraanga"],
    },
    "medical_debt": {
        "en": ["my father's surgery cost {amt} and I borrowed from everyone",
               "hospital bills for my mother's dialysis are draining us",
               "after the accident the private hospital bill is {amt}",
               "cancer treatment loans are pending and medicines are expensive"],
        "ta": ["அப்பாவின் அறுவை சிகிச்சைக்கு கடன் வாங்கினேன்", "அம்மாவின் டயாலிசிஸ் செலவு அதிகம்",
               "மருத்துவமனை கட்டணத்திற்கு கடன்"],
        "tanglish": ["appa operation ku {amt} kadan vaanginen", "amma dialysis selavu romba adhigam",
                     "hospital bill katta kadan vaanginen"],
    },
    "education_loan": {
        "en": ["my education loan EMI started but I still don't have a job",
               "I borrowed for my son's engineering college fees",
               "the bank is asking for education loan repayment after the moratorium",
               "hostel and semester fees made me take a private loan"],
        "ta": ["கல்விக் கடன் EMI தொடங்கியது, இன்னும் வேலை இல்லை", "மகனின் கல்லூரிக் கட்டணத்திற்கு கடன் வாங்கினேன்"],
        "tanglish": ["education loan EMI start aagiduchu, innum velai illa", "paiyan college fees ku kadan vaanginen"],
    },
    "credit_card_debt": {
        "en": ["my credit card bill is {amt} and I only pay the minimum due",
               "personal loan EMI and credit card dues are more than my salary",
               "recovery agents from the bank call me late at night about my card",
               "my CIBIL score dropped after missing personal loan EMIs"],
        "ta": ["கிரெடிட் கார்டு நிலுவை அதிகமாகிவிட்டது", "தனிநபர் கடன் EMI சம்பளத்தை விட அதிகம்"],
        "tanglish": ["credit card bill {amt} aagiduchu, minimum mattum katren", "personal loan EMI salary vida adhigam",
                     "bank recovery aalunga raathiri call panraanga"],
    },
    "general_financial_stress": {
        "en": ["I lost my job and rent is due next week",
               "my salary is not enough for household expenses anymore",
               "I don't know how to manage money and keep running short every month",
               "prices went up and I can't save anything"],
        "ta": ["வேலை போய்விட்டது, வாடகை கட்ட வேண்டும்", "சம்பளம் வீட்டுச் செலவுக்கு போதவில்லை",
               "ஒவ்வொரு மாதமும் பணம் பற்றாக்குறை"],
        "tanglish": ["velai pochu, vaadagai katanum", "salary veetu selavukku podhala", "ovvoru maasamum panam pathala"],
    },
}

# Severity framings with stress score ranges
FRAMES = {
    "low": {
        "range": (8, 30),
        "en": ["{s}. It's manageable but I want to plan better.", "Just checking — {s}. How do I avoid this next time?",
               "{s}, but I'm okay for now.", "I want advice: {s}."],
        "ta": ["{s}. சமாளிக்க முடியும், ஆனால் திட்டமிட வேண்டும்.", "{s}. அடுத்த முறை தவிர்க்க என்ன செய்யலாம்?"],
        "tanglish": ["{s}. manage pannalaam, aana plan pannanum.", "{s}. next time epdi avoid panradhu?"],
    },
    "moderate": {
        "range": (30, 55),
        "en": ["{s} and I'm worried about how to repay.", "{s}. It's getting difficult every month.",
               "{s}. I feel tense about it.", "{s} and my family is worried."],
        "ta": ["{s}, எப்படி திருப்பிச் செலுத்துவது என்று கவலையாக இருக்கிறது.", "{s}. ஒவ்வொரு மாதமும் கஷ்டமாகிறது."],
        "tanglish": ["{s}, epdi thirupi kodukradhunu tension ah irukku.", "{s}. ovvoru maasamum kashtam aagudhu."],
    },
    "high": {
        "range": (55, 80),
        "en": ["{s}. I cannot repay and they are threatening me.", "{s}. I can't sleep, I am scared and trapped.",
               "{s} and I have no money left for food.", "{s}. I'm desperate and don't know what to do."],
        "ta": ["{s}. கட்ட முடியாது, மிரட்டுகிறார்கள்.", "{s}. தூக்கம் இல்லை, பயமாக இருக்கிறது."],
        "tanglish": ["{s}. katta mudiyala, mirattuthu.", "{s}. thookam illa, romba bayama irukku."],
    },
    "critical": {
        "range": (82, 98),
        "en": ["{s}. I feel hopeless, I don't want to live anymore.", "{s}. There is no way out, I am thinking of ending my life.",
               "{s}. They beat me and took everything, I'm helpless."],
        "ta": ["{s}. வாழ விருப்பமில்லை, தற்கொலை செய்யலாம் என்று தோன்றுகிறது.", "{s}. எந்த வழியும் இல்லை, சாக வேண்டும் போல இருக்கிறது."],
        "tanglish": ["{s}. vaazha pidikkala, saaganum pola irukku.", "{s}. vera vazhiye illa, romba hopeless ah irukken."],
    },
}

AMOUNTS = ["₹50,000", "₹1 lakh", "₹2 lakh", "₹30,000", "₹75,000", "₹3 lakh", "Rs 40000", "₹5 lakh"]
SMALL = ["₹500", "₹1,000", "₹2,000", "Rs 300", "₹5,000", "₹10,000"]
PREFIXES = {"en": ["", "Hi, ", "Please help. ", "Sir, ", "Amma here. "], "ta": ["", "வணக்கம், ", "உதவுங்கள். "],
            "tanglish": ["", "Vanakkam, ", "Help pannunga. "]}


def generate(seed: int = 42, per_combo: int = 3) -> list[dict]:
    rng = random.Random(seed)
    rows = []
    for cat, by_lang in SITUATIONS.items():
        for lang, situations in by_lang.items():
            for si, sit in enumerate(situations):
                for level, frame in FRAMES.items():
                    templates = frame[lang]
                    for _ in range(per_combo):
                        s = sit.format(amt=rng.choice(AMOUNTS), small=rng.choice(SMALL))
                        text = rng.choice(PREFIXES[lang]) + rng.choice(templates).format(s=s)
                        lo, hi = frame["range"]
                        rows.append({
                            "text": text, "category": cat, "language": lang,
                            "severity": level, "stress": round(rng.uniform(lo, hi), 1),
                            "group": f"{cat}:{lang}:{si}",
                        })
    rng.shuffle(rows)
    return rows


NEUTRAL = {
    "en": ["hi", "hello there", "good morning", "thank you so much", "what is the capital of France", "can you explain how a bank works",
           "tell me about saving money", "what is inflation", "how do I learn computers", "what is the weather like",
           "I want to plan my finances better", "how does a recurring deposit work", "explain mutual funds simply",
           "what is a credit card", "is it good to buy gold", "how much should I save every month", "what is GST",
           "my salary got credited today", "I cleared my loan last month", "I am doing better now, thanks",
           "who is the chief minister", "how to write a resume", "how to open a savings account", "what is an EMI"],
    "ta": ["வணக்கம்", "நன்றி", "சேமிப்பு பற்றி சொல்லுங்கள்", "வங்கிக் கணக்கு எப்படி திறப்பது", "தங்கம் வாங்குவது நல்லதா",
           "மாதம் எவ்வளவு சேமிக்க வேண்டும்", "என் கடனை முடித்துவிட்டேன்", "இப்போது நன்றாக இருக்கிறேன்"],
    "tanglish": ["vanakkam", "romba nandri", "saving pathi sollunga", "bank account epdi open panradhu", "gold vaangalama",
                 "maasam evlo save pannanum", "kadan mudichitten", "ippo nalla irukken"],
}


def neutral_rows(rng: random.Random) -> list[dict]:
    """Calm / information-seeking messages so the stress model learns what 'not distressed' looks like."""
    rows = []
    for lang, items in NEUTRAL.items():
        for i, t in enumerate(items):
            for _ in range(3):
                rows.append({"text": t, "category": "general_financial_stress", "language": lang, "severity": "none",
                             "stress": round(rng.uniform(3, 14), 1), "group": f"neutral:{lang}:{i}"})
    faq_path = Path(__file__).resolve().parent.parent / "tn_context" / "faq.json"
    if faq_path.exists():
        entries = json.loads(faq_path.read_text(encoding="utf-8"))["entries"]
        for e in entries:
            cat = (e.get("categories") or ["general_financial_stress"])[0]
            for j, q in enumerate(e["q"]):
                rows.append({"text": q, "category": cat, "language": "tanglish" if j == 2 else "en", "severity": "info",
                             "stress": round(rng.uniform(10, 28), 1), "group": f"faq:{e['id']}:{j}"})
    return rows


def write(path: Path = OUT) -> Path:
    rows = generate()
    rows += neutral_rows(random.Random(7))
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return path


def load(path: Path = OUT) -> list[dict]:
    if not path.exists():
        write(path)
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


if __name__ == "__main__":
    p = write()
    print(f"Wrote {sum(1 for _ in open(p, encoding='utf-8'))} rows to {p}")
