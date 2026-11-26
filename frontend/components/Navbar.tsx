"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { clearSession } from "@/lib/auth";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/checkin", label: t("nav_chat") },
    { href: "/dashboard", label: t("nav_dashboard") },
    { href: "/schemes", label: t("nav_schemes") },
    { href: "/tools", label: t("nav_tools") },
    { href: "/rights", label: t("nav_rights") },
    ...(user?.is_admin ? [{ href: "/admin", label: t("nav_admin") }] : []),
  ];

  const logout = () => {
    clearSession();
    setOpen(false);
    router.push("/login");
  };

  return (
    <nav className="navbar">
      <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
        <div className="brand-mark">வ</div>
        <div>
          <div className="brand-name">VazhiAPI</div>
          <div className="brand-tag font-tamil">{t("tagline")}</div>
        </div>
      </Link>

      <div className={`nav-links ${open ? "open" : ""}`}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
            className={`nav-link ${pathname === l.href ? "active" : ""} ${lang === "ta" ? "font-tamil" : ""}`}>
            {l.label}
          </Link>
        ))}
        <div className="nav-mobile-only">
          {user ? (
            <>
              <Link href="/profile" className="nav-link" onClick={() => setOpen(false)}>{t("profile")}</Link>
              <button className="btn-ghost" onClick={logout}>{t("sign_out")}</button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)}><button className="btn-primary">{t("sign_in")}</button></Link>
          )}
        </div>
      </div>

      <div className="nav-right">
        <button onClick={() => setLang(lang === "en" ? "ta" : "en")} className="btn-ghost btn-sm" aria-label="Switch language">
          {lang === "en" ? "தமிழ்" : "English"}
        </button>
        <div className="nav-desktop-only" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user ? (
            <>
              <Link href="/profile" className="nav-user" title={user.email}>
                <span className="avatar">{(user.full_name || user.email || "?").charAt(0).toUpperCase()}</span>
                {user.full_name?.split(" ")[0] || user.email.split("@")[0]}
              </Link>
              <button onClick={logout} className="btn-ghost btn-sm">{t("sign_out")}</button>
            </>
          ) : (
            <Link href="/login"><button className="btn-primary btn-sm">{t("sign_in")}</button></Link>
          )}
        </div>
        <button className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}
