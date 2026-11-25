import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { CategoryExplorer, HeroDemo, PipelineHero, SchemesAndCTA, TrapCalculator } from "@/components/landing/Heroes";

export const metadata: Metadata = {
  title: "VazhiAPI — AI Financial Wellness for Tamil Nadu",
  description: "Tamil Nadu's AI-powered financial distress detection and counselling platform. நம்ம பணம் நம்ம கையில்.",
};

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <HeroDemo />
      <TrapCalculator />
      <CategoryExplorer />
      <PipelineHero />
      <SchemesAndCTA />
      <footer className="footer">
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, color: "var(--text)" }}>VazhiAPI · வழி</div>
            <div>Applied Deep Learning (AM4502) project. General information, not legal or financial advice.</div>
          </div>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            <Link href="/schemes">Schemes</Link><Link href="/tools">Calculators</Link><Link href="/rights">Rights &amp; helplines</Link>
            <a href="tel:14416">Tele-MANAS 14416</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
