interface Props {
  size?: number;
}

export default function KennyAvatar({ size = 40 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kenny AI avatar"
    >
      {/* Body - cylindrical main body */}
      <rect x="10" y="18" width="20" height="14" rx="2" fill="#1a1a1a" />
      {/* Body panel lines */}
      <line x1="14" y1="18" x2="14" y2="32" stroke="#2a2a2a" strokeWidth="0.5" />
      <line x1="26" y1="18" x2="26" y2="32" stroke="#2a2a2a" strokeWidth="0.5" />
      <line x1="10" y1="24" x2="30" y2="24" stroke="#2a2a2a" strokeWidth="0.5" />

      {/* Copper chest panel */}
      <rect x="15" y="19" width="10" height="5" rx="1" fill="#B87333" />
      {/* Chest detail dots */}
      <circle cx="17.5" cy="21.5" r="1" fill="#C9A84C" />
      <circle cx="22.5" cy="21.5" r="1" fill="#C9A84C" />

      {/* Lower body utility panel */}
      <rect x="16" y="26" width="8" height="4" rx="1" fill="#2a2a2a" />
      <rect x="17" y="27" width="2" height="2" rx="0.5" fill="#B87333" />
      <rect x="21" y="27" width="2" height="2" rx="0.5" fill="#B87333" />

      {/* Head - flat-topped R5 dome */}
      <path
        d="M12 18 L12 12 Q12 8 16 8 L24 8 Q28 8 28 12 L28 18 Z"
        fill="#1a1a1a"
      />
      {/* Dome top flat panel */}
      <rect x="14" y="8" width="12" height="3" rx="1" fill="#2a2a2a" />

      {/* Copper dome band */}
      <rect x="12" y="14" width="16" height="2" rx="0.5" fill="#B87333" />

      {/* Photoreceptor eye */}
      <circle cx="20" cy="12" r="2.5" fill="#2a2a2a" />
      <circle cx="20" cy="12" r="1.8" fill="#8B0000" />
      <circle cx="19.2" cy="11.2" r="0.5" fill="#C9A84C" opacity="0.6" />

      {/* Legs */}
      <rect x="11" y="32" width="4" height="5" rx="1" fill="#1a1a1a" />
      <rect x="25" y="32" width="4" height="5" rx="1" fill="#1a1a1a" />
      {/* Center leg */}
      <rect x="18" y="32" width="4" height="4" rx="1" fill="#1a1a1a" />

      {/* Leg copper accents */}
      <rect x="11" y="34" width="4" height="1" fill="#B87333" />
      <rect x="25" y="34" width="4" height="1" fill="#B87333" />

      {/* Feet */}
      <rect x="10" y="36" width="6" height="2" rx="0.5" fill="#2a2a2a" />
      <rect x="24" y="36" width="6" height="2" rx="0.5" fill="#2a2a2a" />
    </svg>
  );
}
