import { useId } from "react";

export interface KennyAvatarProps {
  size?: "xs" | "sm" | "md" | "lg";
  glow?: boolean;
  state?: "idle" | "thinking" | "speaking";
  className?: string;
}

const SIZE_MAP: Record<NonNullable<KennyAvatarProps["size"]>, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 64,
};

// Theme palette — kept in sync with index.css imperial terminal tokens
const NEAR_BLACK = "#080806";
const IMPERIAL_GOLD = "#C9A84C";
const PARCHMENT = "#e0d8c0";

export default function KennyAvatar({
  size = "md",
  glow = false,
  state = "idle",
  className,
}: KennyAvatarProps) {
  const px = SIZE_MAP[size];
  const uid = useId().replace(/:/g, "");
  const animClass =
    state === "thinking"
      ? `kenny-eye-thinking-${uid}`
      : state === "speaking"
      ? `kenny-eye-speaking-${uid}`
      : "";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        width: px,
        height: px,
        filter: glow
          ? `drop-shadow(0 0 6px ${IMPERIAL_GOLD}AA) drop-shadow(0 0 2px ${IMPERIAL_GOLD})`
          : undefined,
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .kenny-eye-thinking-${uid} {
            animation: kenny-blink-${uid} 1.6s ease-in-out infinite;
            transform-origin: center;
          }
          .kenny-eye-speaking-${uid} {
            animation: kenny-pulse-${uid} 0.7s ease-in-out infinite;
            transform-origin: center;
          }
          @keyframes kenny-blink-${uid} {
            0%, 90%, 100% { opacity: 1; }
            94% { opacity: 0.15; }
          }
          @keyframes kenny-pulse-${uid} {
            0%, 100% { opacity: 1; r: 2.6; }
            50% { opacity: 0.55; r: 2.0; }
          }
        }
      `}</style>
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Kenny, Imperial Price Terminal assistant"
      >
        {/* === LEGS === */}
        {/* Left leg */}
        <rect x="8" y="44" width="10" height="14" rx="1.5" fill={NEAR_BLACK} stroke={PARCHMENT} strokeWidth="0.4" />
        <rect x="8" y="50" width="10" height="1.5" fill={IMPERIAL_GOLD} />
        <rect x="6" y="56" width="14" height="3" rx="0.8" fill={NEAR_BLACK} stroke={PARCHMENT} strokeWidth="0.4" />
        {/* Right leg */}
        <rect x="46" y="44" width="10" height="14" rx="1.5" fill={NEAR_BLACK} stroke={PARCHMENT} strokeWidth="0.4" />
        <rect x="46" y="50" width="10" height="1.5" fill={IMPERIAL_GOLD} />
        <rect x="44" y="56" width="14" height="3" rx="0.8" fill={NEAR_BLACK} stroke={PARCHMENT} strokeWidth="0.4" />

        {/* === BODY === */}
        <rect x="18" y="26" width="28" height="22" rx="2.5" fill={NEAR_BLACK} stroke={PARCHMENT} strokeWidth="0.5" />
        {/* Vertical panel lines */}
        <line x1="24" y1="28" x2="24" y2="46" stroke={PARCHMENT} strokeWidth="0.3" opacity="0.5" />
        <line x1="40" y1="28" x2="40" y2="46" stroke={PARCHMENT} strokeWidth="0.3" opacity="0.5" />
        {/* Horizontal panel band */}
        <line x1="18" y1="36" x2="46" y2="36" stroke={PARCHMENT} strokeWidth="0.3" opacity="0.4" />

        {/* Gold chest plate */}
        <rect x="26" y="29" width="12" height="5" rx="0.8" fill={IMPERIAL_GOLD} />
        <circle cx="29" cy="31.5" r="0.9" fill={NEAR_BLACK} />
        <circle cx="35" cy="31.5" r="0.9" fill={NEAR_BLACK} />

        {/* Lower utility panel */}
        <rect x="25" y="39" width="14" height="6" rx="0.8" fill="#1a1a17" stroke={PARCHMENT} strokeWidth="0.3" />
        <rect x="27" y="41" width="3" height="2.5" rx="0.4" fill={IMPERIAL_GOLD} />
        <rect x="31" y="41" width="3" height="2.5" rx="0.4" fill={IMPERIAL_GOLD} />
        <rect x="35" y="41" width="3" height="2.5" rx="0.4" fill={IMPERIAL_GOLD} />

        {/* Subtle weathering scratches */}
        <line x1="20" y1="42" x2="22" y2="44" stroke={PARCHMENT} strokeWidth="0.25" opacity="0.3" />
        <line x1="42" y1="30" x2="44" y2="32" stroke={PARCHMENT} strokeWidth="0.25" opacity="0.3" />

        {/* === HEAD (half-dome) === */}
        <path
          d="M16 26 L16 18 Q16 8 32 8 Q48 8 48 18 L48 26 Z"
          fill={NEAR_BLACK}
          stroke={PARCHMENT}
          strokeWidth="0.5"
        />
        {/* Dome cap accent */}
        <path
          d="M22 12 Q32 8 42 12"
          stroke={PARCHMENT}
          strokeWidth="0.4"
          fill="none"
          opacity="0.4"
        />

        {/* Gold dome band */}
        <rect x="16" y="22" width="32" height="2.5" fill={IMPERIAL_GOLD} />
        <line x1="16" y1="22" x2="48" y2="22" stroke={NEAR_BLACK} strokeWidth="0.3" />
        <line x1="16" y1="24.5" x2="48" y2="24.5" stroke={NEAR_BLACK} strokeWidth="0.3" />

        {/* Side dome rivets */}
        <circle cx="18.5" cy="20" r="0.6" fill={IMPERIAL_GOLD} />
        <circle cx="45.5" cy="20" r="0.6" fill={IMPERIAL_GOLD} />

        {/* === PHOTORECEPTOR EYE === */}
        <circle cx="32" cy="16" r="4.5" fill="#1a1a17" stroke={PARCHMENT} strokeWidth="0.4" />
        <circle cx="32" cy="16" r="3.4" fill={NEAR_BLACK} />
        <circle
          cx="32"
          cy="16"
          r="2.6"
          fill={IMPERIAL_GOLD}
          className={animClass}
        />
        {/* Eye highlight */}
        <circle cx="31" cy="15" r="0.8" fill={PARCHMENT} opacity="0.7" />

        {/* Small side sensors */}
        <circle cx="22" cy="16" r="0.9" fill={IMPERIAL_GOLD} opacity="0.85" />
        <circle cx="42" cy="16" r="0.9" fill={IMPERIAL_GOLD} opacity="0.85" />
      </svg>
    </span>
  );
}
