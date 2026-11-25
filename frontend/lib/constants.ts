export const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
  "Erode", "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai",
  "Mayiladuthurai", "Nagapattinam", "Namakkal", "The Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
  "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
];

export const CATEGORY_META: Record<string, { label: string; label_ta: string; icon: string; color: string }> = {
  blade_finance: { label: "Blade Finance", label_ta: "கந்து வட்டி", icon: "⚡", color: "#ef4444" },
  chit_fund_default: { label: "Chit Fund", label_ta: "சீட்டு", icon: "🏦", color: "#f97316" },
  gold_loan_overdue: { label: "Gold Loan", label_ta: "நகைக் கடன்", icon: "💛", color: "#eab308" },
  agricultural_debt: { label: "Agricultural", label_ta: "விவசாயம்", icon: "🌾", color: "#22c55e" },
  wedding_debt: { label: "Wedding", label_ta: "திருமணம்", icon: "💍", color: "#a855f7" },
  festival_credit: { label: "Festival", label_ta: "பண்டிகை", icon: "🪔", color: "#3b82f6" },
  microfinance_debt: { label: "Microfinance", label_ta: "குழுக் கடன்", icon: "👥", color: "#14b8a6" },
  loan_app_harassment: { label: "Loan App", label_ta: "கடன் செயலி", icon: "📱", color: "#ec4899" },
  medical_debt: { label: "Medical", label_ta: "மருத்துவம்", icon: "🏥", color: "#f43f5e" },
  education_loan: { label: "Education", label_ta: "கல்வி", icon: "🎓", color: "#6366f1" },
  credit_card_debt: { label: "Credit Card", label_ta: "கிரெடிட் கார்டு", icon: "💳", color: "#0ea5e9" },
  general_financial_stress: { label: "General", label_ta: "பொது", icon: "🧭", color: "#94a3b8" },
};

export const ACTION_ICONS: Record<string, string> = {
  validate: "🤝", legal_rights: "⚖️", shg_alternative: "🏦", escalate: "🚨",
};

export const stressColor = (s: number) => (s >= 75 ? "#ef4444" : s >= 50 ? "#f97316" : s >= 25 ? "#eab308" : "#10b981");

export const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
