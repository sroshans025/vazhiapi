import {
  Coins, Compass, CreditCard, Flame, Gem, Gift, GraduationCap, HandCoins, HeartHandshake, Landmark, PhoneCall,
  PiggyBank, Scale, Smartphone, Stethoscope, Users, Wheat, type LucideIcon,
} from "lucide-react";

export const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
  "Erode", "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai",
  "Mayiladuthurai", "Nagapattinam", "Namakkal", "The Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
  "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
];

/** Colours are 700-level so they stay readable as text on the light background. */
export const CATEGORY_META: Record<string, { label: string; label_ta: string; Icon: LucideIcon; color: string }> = {
  blade_finance: { label: "Blade Finance", label_ta: "கந்து வட்டி", Icon: HandCoins, color: "#b91c1c" },
  chit_fund_default: { label: "Chit Fund", label_ta: "சீட்டு", Icon: Coins, color: "#c2410c" },
  gold_loan_overdue: { label: "Gold Loan", label_ta: "நகைக் கடன்", Icon: Gem, color: "#a16207" },
  agricultural_debt: { label: "Agricultural", label_ta: "விவசாயம்", Icon: Wheat, color: "#15803d" },
  wedding_debt: { label: "Wedding", label_ta: "திருமணம்", Icon: Gift, color: "#7e22ce" },
  festival_credit: { label: "Festival", label_ta: "பண்டிகை", Icon: Flame, color: "#b45309" },
  microfinance_debt: { label: "Microfinance", label_ta: "குழுக் கடன்", Icon: Users, color: "#0f766e" },
  loan_app_harassment: { label: "Loan App", label_ta: "கடன் செயலி", Icon: Smartphone, color: "#be185d" },
  medical_debt: { label: "Medical", label_ta: "மருத்துவம்", Icon: Stethoscope, color: "#be123c" },
  education_loan: { label: "Education", label_ta: "கல்வி", Icon: GraduationCap, color: "#4338ca" },
  credit_card_debt: { label: "Credit Card", label_ta: "கிரெடிட் கார்டு", Icon: CreditCard, color: "#0369a1" },
  general_financial_stress: { label: "General", label_ta: "பொது", Icon: Compass, color: "#57534e" },
};

export const ACTION_ICONS: Record<string, LucideIcon> = {
  validate: HeartHandshake, legal_rights: Scale, shg_alternative: PiggyBank, escalate: PhoneCall,
};

export const SchemeIcon = Landmark;

export const stressColor = (s: number) => (s >= 75 ? "#b91c1c" : s >= 50 ? "#c2410c" : s >= 25 ? "#a16207" : "#15803d");

export const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
