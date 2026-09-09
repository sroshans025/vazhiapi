"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { href: "/checkin", label: "Check-In", labelTa: "பரிசோதனை" },
  { href: "/dashboard", label: "Dashboard", labelTa: "கட்டுப்பாடு" },
  { href: "/schemes", label: "Schemes", labelTa: "திட்டங்கள்" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ta">("en");
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("vazhi_user");
    if (stored) setUser(JSON.parse(stored));
    const storedLang = localStorage.getItem("vazhi_lang") as "en" | "ta" | null;
    if (storedLang) setLang(storedLang);
  }, []);

  const toggleLang = () => {
    const next = lang === "en" ? "ta" : "en";
    setLang(next);
    localStorage.setItem("vazhi_lang", next);
  };

  const logout = () => {
    localStorage.removeItem("vazhi_token");
    localStorage.removeItem("vazhi_user");
    router.push("/login");
  };

  return (
    <nav className="navbar">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 no-underline">
        <div style={{
          width: 36, height: 36, borderRadius: "10px",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.25rem", fontWeight: 800, color: "#0f0c29",
        }}>வ</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "#f1f5f9", lineHeight: 1.1 }}>VazhiAPI</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(245,158,11,0.8)", fontFamily: "'Noto Sans Tamil', sans-serif" }}>
            {lang === "ta" ? "நம்ம பணம் நம்ம கையில்" : "Your Money, Your Wellness"}
          </div>
        </div>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-6">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: pathname === link.href ? "#f59e0b" : "rgba(241,245,249,0.75)",
              fontWeight: pathname === link.href ? 600 : 400,
              fontSize: "0.9rem",
              transition: "color 0.2s",
              textDecoration: "none",
              fontFamily: lang === "ta" ? "'Noto Sans Tamil', sans-serif" : undefined,
            }}
          >
            {lang === "ta" ? link.labelTa : link.label}
          </Link>
        ))}
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Lang toggle */}
        <button onClick={toggleLang} className="btn-ghost" style={{ padding: "0.4rem 0.875rem", fontSize: "0.8rem" }}>
          {lang === "en" ? "தமிழ்" : "English"}
        </button>

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link href="/admin" style={{ fontSize: "0.8rem", color: "rgba(241,245,249,0.6)", textDecoration: "none" }}>
              {user.full_name || user.email?.split("@")[0]}
            </Link>
            <button onClick={logout} className="btn-ghost" style={{ padding: "0.4rem 0.875rem", fontSize: "0.8rem" }}>
              Logout
            </button>
          </div>
        ) : (
          <Link href="/login">
            <button className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem" }}>
              {lang === "ta" ? "உள்நுழைவு" : "Sign In"}
            </button>
          </Link>
        )}
      </div>
    </nav>
  );
}
