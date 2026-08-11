/**
 * OrderNook brand mark — the glossy green "ON" logo.
 *
 * Recreated in code from the chosen concept (a bright glossy green pill, big
 * white "ON" with "rder" / "ook" micro-labels spelling OrderNook). Exports:
 *   <OnMark />    the square pill on its own (favicon / app icon / avatar)
 *   <OnPill />    the horizontal capsule wordmark (nav bar, footer, headers)
 *   <OnLockup />  the pill stacked over the "Orders made Easy" tagline, centred
 */

/** Shared gradient + shine defs. `id` keeps multiple instances unique-ish. */
function GlossDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#63C23A" />
        <stop offset="0.5" stopColor="#33A00F" />
        <stop offset="1" stopColor="#1C7D06" />
      </linearGradient>
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <filter id={`${id}-txt`} x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow
          dx="0"
          dy="1.5"
          stdDeviation="1"
          floodColor="#0b4a00"
          floodOpacity="0.45"
        />
      </filter>
    </defs>
  );
}

type OnMarkProps = {
  size?: number;
  /** "full" spells O·rder·N·ook; "initials" shows just "ON" (small sizes). */
  detail?: "full" | "initials";
  className?: string;
  title?: string;
};

/** Square pill — used where a 1:1 icon is required (favicon, PWA icon). */
export function OnMark({
  size = 48,
  detail = "initials",
  className,
  title = "OrderNook",
}: OnMarkProps) {
  const showMicro = detail === "full" && size >= 44;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <GlossDefs id="onm" />
      <clipPath id="onm-clip">
        <rect x="6" y="6" width="108" height="108" rx="30" />
      </clipPath>
      <g clipPath="url(#onm-clip)">
        <rect x="6" y="6" width="108" height="108" fill="url(#onm-face)" />
        <ellipse cx="60" cy="20" rx="66" ry="36" fill="url(#onm-shine)" />
      </g>
      <rect
        x="6"
        y="6"
        width="108"
        height="108"
        rx="30"
        fill="none"
        stroke="#0c5200"
        strokeWidth="3"
      />
      <rect
        x="9"
        y="9"
        width="102"
        height="102"
        rx="26"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {showMicro ? (
        <text
          x="60"
          y="74"
          textAnchor="middle"
          fontFamily="var(--font-poppins), 'Poppins', system-ui, sans-serif"
          fontWeight="800"
          letterSpacing="-1.5"
          fill="#ffffff"
          filter="url(#onm-txt)"
        >
          <tspan fontSize="42">O</tspan>
          <tspan fontSize="16" dy="-4" fill="#EAFBE0">
            rder
          </tspan>
          <tspan fontSize="42" dy="4">
            N
          </tspan>
          <tspan fontSize="16" dy="-4" fill="#EAFBE0">
            ook
          </tspan>
        </text>
      ) : (
        <text
          x="60"
          y="62"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-poppins), 'Poppins', system-ui, sans-serif"
          fontWeight="800"
          fontSize="56"
          letterSpacing="-2"
          fill="#ffffff"
          filter="url(#onm-txt)"
        >
          ON
        </text>
      )}
    </svg>
  );
}

type OnPillProps = {
  /** Rendered height in px; width scales with the 300×124 viewBox. */
  height?: number;
  className?: string;
  title?: string;
};

/** Horizontal glossy capsule spelling OrderNook (the primary wordmark). */
export function OnPill({ height = 44, className, title = "OrderNook" }: OnPillProps) {
  const width = (height * 300) / 124;
  return (
    <svg
      viewBox="0 0 300 124"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <GlossDefs id="onp" />
      <clipPath id="onp-clip">
        <rect x="4" y="4" width="292" height="116" rx="58" />
      </clipPath>
      <g clipPath="url(#onp-clip)">
        <rect x="4" y="4" width="292" height="116" fill="url(#onp-face)" />
        <ellipse cx="150" cy="18" rx="170" ry="40" fill="url(#onp-shine)" />
      </g>
      <rect
        x="4"
        y="4"
        width="292"
        height="116"
        rx="58"
        fill="none"
        stroke="#0c5200"
        strokeWidth="3.5"
      />
      <rect
        x="8"
        y="8"
        width="284"
        height="108"
        rx="54"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      <text
        x="150"
        y="86"
        textAnchor="middle"
        fontFamily="var(--font-poppins), 'Poppins', system-ui, sans-serif"
        fontWeight="800"
        letterSpacing="-2"
        fill="#ffffff"
        filter="url(#onp-txt)"
      >
        <tspan fontSize="74">O</tspan>
        <tspan fontSize="27" dy="-8" fill="#EAFBE0">
          rder
        </tspan>
        <tspan fontSize="74" dy="8">
          N
        </tspan>
        <tspan fontSize="27" dy="-8" fill="#EAFBE0">
          ook
        </tspan>
      </text>
    </svg>
  );
}

type OnLockupProps = {
  /** Pill height in px. Tagline scales with it. */
  height?: number;
  className?: string;
};

/** Pill centred over the "Orders made Easy" tagline (full brand lockup). */
export function OnLockup({ height = 72, className }: OnLockupProps) {
  return (
    <span
      className={`inline-flex flex-col items-center gap-3 ${className ?? ""}`}
    >
      <OnPill height={height} />
      <span
        className="font-heading font-semibold tracking-wide text-[color:var(--brand-dark)]"
        style={{ fontSize: Math.max(13, height * 0.26) }}
      >
        Orders made Easy
      </span>
    </span>
  );
}
