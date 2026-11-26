"use client";
import { useRouter } from "next/navigation";
import { startGuest } from "@/lib/guest";
import { useLang } from "@/lib/i18n";

/** "Continue without an account" — guest mode keeps chats on this device and needs no server. */
export default function GuestEntry({ prominent = false, name, district }: { prominent?: boolean; name?: string; district?: string }) {
  const router = useRouter();
  const { lang } = useLang();
  const go = () => { startGuest({ name: name?.trim() || undefined, district: district || undefined, lang }); router.push("/checkin"); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "stretch" }}>
      <button type="button" onClick={go} className={prominent ? "btn-primary" : "btn-ghost"} style={{ width: "100%" }}>
        <span>{lang === "ta" ? "கணக்கு இல்லாமல் தொடரவும் →" : "Continue without an account →"}</span>
      </button>
      <div className="muted" style={{ fontSize: "0.74rem", textAlign: "center", lineHeight: 1.5 }}>
        {lang === "ta"
          ? "உரையாடல்கள் இந்தச் சாதனத்தில் மட்டும் சேமிக்கப்படும். எப்போது வேண்டுமானாலும் நீக்கலாம்."
          : "Chats are saved only on this device. Nothing is sent to our servers. Delete anytime."}
      </div>
    </div>
  );
}
