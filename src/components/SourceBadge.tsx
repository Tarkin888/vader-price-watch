import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: string;
  size?: "sm" | "md";
  className?: string;
}

/** Compact inline auction-house badge with monogram + name */
const SourceBadge = ({ source, size = "sm", className }: SourceBadgeProps) => {
  const config = BADGE_CONFIG[source];
  if (!config) return <span className="text-muted-foreground text-xs">{source}</span>;

  const isSm = size === "sm";
  const w = isSm ? 144 : 120;
  const h = isSm ? 40 : 32;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={cn("inline-block shrink-0", className)}
      role="img"
      aria-label={`${source} Auctions`}
    >
      {/* Border frame */}
      <rect
        x="0.5"
        y="0.5"
        width={w - 1}
        height={h - 1}
        rx="2"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="0.75"
        opacity="0.5"
      />
      {/* Monogram */}
      <text
        x={config.monoX ?? (isSm ? 6 : 10)}
        y={h / 2}
        dominantBaseline="central"
        className="fill-primary"
        fontFamily="Georgia, serif"
        fontWeight="bold"
        fontSize={isSm ? 20 : 16}
        letterSpacing="0.5"
      >
        {config.monogram}
      </text>
      {/* Divider line */}
      <line
        x1={config.dividerX[size === "sm" ? 0 : 1]}
        y1={isSm ? 3 : 5}
        x2={config.dividerX[size === "sm" ? 0 : 1]}
        y2={h - (isSm ? 3 : 5)}
        stroke="hsl(var(--primary))"
        strokeWidth="0.5"
        opacity="0.4"
      />
      {/* Name */}
      <text
        x={config.nameX[size === "sm" ? 0 : 1]}
        y={h / 2}
        dominantBaseline="central"
        className="fill-foreground"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        fontSize={isSm ? 14 : 10}
        letterSpacing="1"
      >
        {config.label}
      </text>
      {/* Currency tag */}
      <text
        x={w - (isSm ? 5 : 8)}
        y={h / 2}
        dominantBaseline="central"
        textAnchor="end"
        className="fill-muted-foreground"
        fontFamily="system-ui, sans-serif"
        fontSize={isSm ? 10 : 7}
        letterSpacing="0.5"
        opacity="0.7"
      >
        {config.currency}
      </text>
    </svg>
  );
};

const BADGE_CONFIG: Record<string, {
  monogram: string;
  label: string;
  currency: string;
  monoX?: number;
  dividerX: [number, number]; // [sm, md]
  nameX: [number, number];
}> = {
  Heritage: {
    monogram: "HA",
    label: "HERITAGE",
    currency: "USD",
    monoX: 8,
    dividerX: [40, 32],
    nameX: [44, 36],
  },
  Hakes: {
    monogram: "H",
    label: "HAKE'S",
    currency: "USD",
    monoX: 10,
    dividerX: [28, 22],
    nameX: [32, 26],
  },
  Vectis: {
    monogram: "V",
    label: "VECTIS",
    currency: "GBP",
    monoX: 10,
    dividerX: [28, 22],
    nameX: [32, 26],
  },
  LCG: {
    monogram: "LCG",
    label: "LCG",
    currency: "GBP",
    monoX: 6,
    dividerX: [50, 36],
    nameX: [54, 40],
  },
};

export default SourceBadge;
