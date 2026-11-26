"use client";
import { useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

const NUMBERS = [
  { name: "Emergency", name_ta: "அவசர உதவி", number: "112", note: "Police · Ambulance · Fire" },
  { name: "Tele-MANAS (mental health)", name_ta: "டெலி-மனஸ் (மனநலம்)", number: "14416", note: "24×7 · Tamil available" },
  { name: "Cyber crime / loan-app threats", name_ta: "சைபர் / கடன் செயலி மிரட்டல்", number: "1930", note: "24×7" },
  { name: "Free legal aid (DLSA)", name_ta: "இலவச சட்ட உதவி", number: "15100", note: "Office hours" },
  { name: "Women helpline", name_ta: "மகளிர் உதவி", number: "181", note: "24×7" },
];

export default function SOSButton() {
  const [open, setOpen] = useState(false);
  const { lang, t } = useLang();
  return (
    <>
      <button className="sos-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("sos")}>
        {open ? <X size={18} /> : <LifeBuoy size={18} />} {open ? (lang === "ta" ? "மூடு" : "Close") : (lang === "ta" ? "உதவி" : "Get help")}
      </button>
      {open && (
        <div className="sos-panel glass-solid" role="dialog" aria-label={t("sos")}>
          <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>{t("sos")}</div>
          <div className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.75rem" }}>
            {lang === "ta" ? "இலவசம் · ரகசியம் · நீங்கள் தனியாக இல்லை" : "Free, confidential, and you are not alone."}
          </div>
          {NUMBERS.map((n) => (
            <a key={n.number} href={`tel:${n.number}`} className="sos-row">
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }} className={lang === "ta" ? "font-tamil" : ""}>{lang === "ta" ? n.name_ta : n.name}</div>
                <div className="muted" style={{ fontSize: "0.74rem" }}>{n.note}</div>
              </div>
              <span className="sos-num">{n.number}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
