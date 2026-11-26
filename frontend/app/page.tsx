import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { CategoryExplorer, HeroIntro, HowItWorks, LiveDemo, SchemesAndCTA, Stories, TrapCalculator } from "@/components/landing/Heroes";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "VazhiAPI — Financial wellness help for Tamil Nadu",
  description: "Free, confidential help with debt in Tamil Nadu: your legal rights, matching government schemes and next steps. நம்ம பணம் நம்ம கையில்.",
};

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <HeroIntro />
      <LiveDemo />
      <TrapCalculator />
      <Stories />
      <CategoryExplorer />
      <HowItWorks />
      <SchemesAndCTA />
      <footer className="footer">
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontWeight: 800, color: "var(--text)", marginBottom: "0.25rem" }}>VazhiAPI · <span className="font-tamil">வழி</span></div>
              <div>General information, not legal or financial advice. In an emergency call 112; for mental-health support call Tele-MANAS 14416.</div>
            </div>
            <nav style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }} aria-label="Footer">
              <Link href="/schemes">Schemes</Link><Link href="/tools">Calculators</Link><Link href="/rights">Rights &amp; helplines</Link><Link href="/checkin">Chat</Link>
            </nav>
          </div>
          <div style={{ fontSize: "0.76rem", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            Photos from Wikimedia Commons:{" "}
            {Object.values(PHOTOS).map((p, i) => (
              <span key={p.src}>
                {i > 0 && " · "}
                <a href={p.source} target="_blank" rel="noopener noreferrer">{p.caption}</a> by {p.author}, <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">{p.license}</a>
              </span>
            ))}
            . Applied Deep Learning (AM4502) project.
          </div>
        </div>
      </footer>
    </main>
  );
}
