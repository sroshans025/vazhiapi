import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { ACTION_ICONS, CATEGORY_META } from "@/lib/constants";

/** Icon for the recommended strategy (validate / legal rights / SHG / escalate). */
export function ActionIcon({ action, size = 16 }: { action: string; size?: number }) {
  const I = ACTION_ICONS[action];
  return I ? <I size={size} color="var(--primary)" className="icon" aria-hidden /> : null;
}

/** Up / down / flat trend icon (stress rising is bad, so it's red). */
export function TrendIcon({ t, size = 16 }: { t?: string | null; size?: number }) {
  const v = (t || "").toLowerCase();
  if (v === "rising") return <TrendingUp size={size} color="var(--danger)" className="icon" aria-hidden />;
  if (v === "declining") return <TrendingDown size={size} color="var(--success)" className="icon" aria-hidden />;
  return <Minus size={size} color="var(--accent)" className="icon" aria-hidden />;
}

/** Line icon for a debt category, optionally in a soft tinted tile. */
export default function CategoryIcon({ id, size = 18, tile = false }: { id: string; size?: number; tile?: boolean }) {
  const m = CATEGORY_META[id] ?? CATEGORY_META.general_financial_stress;
  const icon = <m.Icon size={size} color={m.color} strokeWidth={2} className="icon" aria-hidden />;
  if (!tile) return icon;
  return (
    <span className="icon-tile" style={{ background: `${m.color}14`, border: `1px solid ${m.color}2a`, width: size + 20, height: size + 20 }}>
      {icon}
    </span>
  );
}
