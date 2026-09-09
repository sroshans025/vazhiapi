"use client";

interface StressGaugeProps {
  score: number;
  label: string;
  size?: number;
}

export default function StressGauge({ score, label, size = 140 }: StressGaugeProps) {
  const r = (size / 2) - 16;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ * 0.75; // 270-degree arc

  const color =
    score >= 75 ? "#ef4444" :
    score >= 50 ? "#f97316" :
    score >= 25 ? "#fbbf24" : "#10b981";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`} style={{ overflow: "visible" }}>
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={12}
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
        {/* Filled arc */}
        <circle
          cx={size / 2} cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeDasharray={`${circ * 0.75 - offset} ${circ - (circ * 0.75 - offset)}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)`, transition: "stroke-dasharray 0.8s ease" }}
        />
        {/* Score text */}
        <text x={size / 2} y={size / 2 + 6} textAnchor="middle"
          fill={color} fontSize={size * 0.22} fontWeight="800" fontFamily="Inter, sans-serif">
          {Math.round(score)}
        </text>
      </svg>
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color }}>
        {label}
      </div>
      <div style={{ fontSize: "0.7rem", color: "rgba(241,245,249,0.4)" }}>Stress Score / 100</div>
    </div>
  );
}
