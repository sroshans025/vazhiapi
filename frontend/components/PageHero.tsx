export default function PageHero({ eyebrow, title, subtitle, children }: {
  eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="hero" style={{ padding: "2.25rem 0 1.75rem", marginBottom: "1rem" }}>
      <div className="hero-orb" style={{ width: 300, height: 300, background: "#6d28d9", top: -140, right: -60, opacity: 0.3 }} />
      <div style={{ position: "relative" }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>{eyebrow}</div>}
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.4rem)", fontWeight: 800, lineHeight: 1.15, marginBottom: "0.5rem" }}>{title}</h1>
        {subtitle && <p style={{ color: "var(--text-2)", maxWidth: 720, lineHeight: 1.7 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
