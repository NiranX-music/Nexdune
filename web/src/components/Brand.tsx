/** Nexus Monolith emblem; wordmark uses its Bytesized font.
 *
 * Saturated brand palette matches site/nexdune-icon.svg and works on both light and dark themes.
 */
export function Brand({ word = false }: { word?: boolean }) {
  return (
    <span className={word ? "nexdune-brand full" : "nexdune-brand"} aria-label="nexdune">
      <svg viewBox="0 0 512 512" aria-hidden="true" stroke="none">
        <defs>
          <linearGradient id="nex-brand-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0a0d14"/>
            <stop offset="100%" stopColor="#05070a"/>
          </linearGradient>
          <linearGradient id="nex-brand-pri" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f2fe"/>
            <stop offset="50%" stopColor="#4facfe"/>
            <stop offset="100%" stopColor="#6366f1"/>
          </linearGradient>
          <linearGradient id="nex-brand-dune" x1="120" y1="360" x2="380" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b"/>
            <stop offset="50%" stopColor="#fbbf24"/>
            <stop offset="100%" stopColor="#00f2fe"/>
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="112" fill="url(#nex-brand-bg)"/>
        <rect width="510" height="510" x="1" y="1" rx="111" stroke="url(#nex-brand-pri)" strokeWidth="2" strokeOpacity="0.3"/>
        <g transform="translate(0, 0)">
          <path d="M128 376V156C128 142.745 138.745 132 152 132H184C197.255 132 208 142.745 208 156V376C208 389.255 197.255 400 184 400H152C138.745 400 128 389.255 128 376Z" fill="url(#nex-brand-pri)"/>
          <path d="M304 376V156C304 142.745 314.745 132 328 132H360C373.255 132 384 142.745 384 156V376C384 389.255 373.255 400 360 400H328C314.745 400 304 389.255 304 376Z" fill="url(#nex-brand-pri)"/>
          <path d="M184 144L328 356C335 366.5 348 370 358 363L366 357C376 350 378 337 371 326.5L227 114C220 103.5 207 100 197 107L189 113C179 120 177 133 184 144Z" fill="url(#nex-brand-dune)"/>
          <circle cx="256" cy="235" r="14" fill="#ffffff"/>
          <path d="M112 424C196 396 316 452 400 424" stroke="url(#nex-brand-dune)" strokeWidth="8" strokeLinecap="round" strokeOpacity="0.8"/>
        </g>
      </svg>
      {word && <span className="nexdune-word">nexdune</span>}
    </span>
  )
}
