// Decorative arcade of round arches — echoes the bridge/minaret motif in the
// wordmark. Tiled via SVG <pattern> so it scales to any panel size.
export function ArchPattern({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="arch-lattice" width="100" height="130" patternUnits="userSpaceOnUse">
          <path
            d="M10,130 L10,60 A40,40 0 0 1 90,60 L90,130"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#arch-lattice)" />
    </svg>
  );
}
