"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Language } from "@/types";

const DICT = {
  nav_chat: { en: "Chat", ta: "உரையாடல்" },
  nav_dashboard: { en: "Dashboard", ta: "டாஷ்போர்டு" },
  nav_schemes: { en: "Schemes", ta: "திட்டங்கள்" },
  nav_tools: { en: "Tools", ta: "கருவிகள்" },
  nav_rights: { en: "Rights & Help", ta: "உரிமைகள்" },
  nav_admin: { en: "Admin", ta: "நிர்வாகம்" },
  sign_in: { en: "Sign In", ta: "உள்நுழைவு" },
  sign_out: { en: "Sign out", ta: "வெளியேறு" },
  profile: { en: "Profile", ta: "சுயவிவரம்" },
  tagline: { en: "Your Money, Your Wellness", ta: "நம்ம பணம் நம்ம கையில்" },
  sos: { en: "Need help now?", ta: "உடனடி உதவி?" },
  chat_placeholder: { en: "Tell me what's going on… (Tamil, English or Tanglish)", ta: "உங்கள் நிலையைச் சொல்லுங்கள்… (தமிழ் / English)" },
  new_chat: { en: "New chat", ta: "புதிய உரையாடல்" },
  talk_human: { en: "Talk to a counsellor", ta: "ஆலோசகரிடம் பேசு" },
  helpful: { en: "Was this helpful?", ta: "இது உதவியதா?" },
} as const;

export type DictKey = keyof typeof DICT;

interface Ctx { lang: Language; setLang: (l: Language) => void; t: (k: DictKey) => string; }
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => DICT[k].en });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    // Read the saved preference after hydration (server render is always "en").
    const id = setTimeout(() => {
      try {
        const stored = localStorage.getItem("vazhi_lang") as Language | null;
        if (stored === "en" || stored === "ta") setLangState(stored);
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem("vazhi_lang", l); } catch {}
  }, []);

  const t = useCallback((k: DictKey) => DICT[k][lang], [lang]);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
