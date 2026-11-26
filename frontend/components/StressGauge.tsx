"use client";
import { useEffect, useState } from "react";
import { stressColor } from "@/lib/constants";

interface StressGaugeProps { score: number; label: string; size?: number; caption?: string }

/** 270° arc gauge that animates from its previous value. */
export default function StressGauge({ score, label, size = 140, caption = "Stress Score / 100" }: StressGaugeProps) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = shown;
    const to = Math.max(0, Math.min(100, score));
    const tick = (t: number) => {
      const p = Math.min((t - start) / 700, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const filled = (shown / 100) * arc;
  const color = stressColor(shown);
  const c = size / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} role="img" aria-label={`Stress ${Math.round(score)} of 100, ${label}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={12}
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(135 ${c} ${c})`} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(135 ${c} ${c})`}
          />
        <text x={c} y={c + 8} textAnchor="middle" fill={color} fontSize={size * 0.24} fontWeight="800" fontFamily="Inter, sans-serif">
          {Math.round(shown)}
        </text>
      </svg>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, color }}>{label}</div>
      {caption && <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{caption}</div>}
    </div>
  );
}
