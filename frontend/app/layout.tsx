import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import SOSButton from "@/components/SOSButton";

// Self-hosted at build time by next/font: no runtime request to Google, no layout shift.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil", display: "swap" });

export const metadata: Metadata = {
  title: "VazhiAPI — Tamil Nadu Financial Wellness Platform",
  description: "AI-powered financial distress analysis and counselling for Tamil Nadu. நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness.",
  keywords: "Tamil Nadu, financial wellness, debt counselling, SHG, kandhu vatti, blade finance, loan app harassment, government schemes",
  openGraph: { title: "VazhiAPI — வழி", description: "நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5b2a86" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${tamil.variable}`}>
      <body>
        <LanguageProvider>
          {children}
          <SOSButton />
        </LanguageProvider>
      </body>
    </html>
  );
}
