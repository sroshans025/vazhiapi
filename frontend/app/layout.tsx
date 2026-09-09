import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VazhiAPI — Tamil Nadu Financial Wellness Platform",
  description: "AI-powered financial distress analysis and counselling for Tamil Nadu. நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness.",
  keywords: "Tamil Nadu, financial wellness, debt counselling, SHG, blade finance, AI counselling",
  openGraph: {
    title: "VazhiAPI — வழி",
    description: "நம்ம பணம் நம்ம கையில் — Your Money, Your Wellness",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
