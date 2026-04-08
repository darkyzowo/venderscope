/**
 * VSLogo — VenderScope "VS" wordmark
 *
 * Renders the official VS wordmark as an inline SVG.
 * ViewBox is trimmed from the original 680×300 to the actual content bounds
 * (126 46 312 198), removing the empty right-hand region.
 *
 * When `animated` is true, each stroke draws in sequentially via CSS
 * stroke-dashoffset animation (see index.css .vs-logo-animated rules).
 * pathLength="1" normalises each element's stroke length to 1, so
 * stroke-dasharray/dashoffset values are always in [0, 1] regardless of
 * the element's actual pixel length.
 */
export default function VSLogo({ height = 40, animated = false, className = '' }) {
  // Maintain aspect ratio of the trimmed viewBox (312 ÷ 198 ≈ 1.576)
  const width = Math.round(height * (312 / 198))

  return (
    <svg
      viewBox="126 46 312 198"
      width={width}
      height={height}
      fill="none"
      aria-label="VenderScope"
      role="img"
      className={`${animated ? 'vs-logo-animated' : ''} ${className}`.trim()}
    >
      {/* V — left stroke (near-white) */}
      <line
        className="vs-v-left"
        x1="140" y1="60"
        x2="210" y2="230"
        stroke="#f0f0ff"
        strokeWidth="28"
        strokeLinecap="round"
        pathLength="1"
      />
      {/* V — right stroke (medium violet) */}
      <line
        className="vs-v-right"
        x1="210" y1="230"
        x2="280" y2="60"
        stroke="#7F77DD"
        strokeWidth="28"
        strokeLinecap="round"
        pathLength="1"
      />
      {/* S — custom path (deeper violet, brightened for small-size legibility) */}
      <path
        className="vs-s"
        d="M340,100 C340,78 358,62 382,62 C406,62 424,78 424,98
           C424,118 406,132 382,132 C358,132 340,148 340,168
           C340,188 358,206 382,206 C406,206 424,190 424,168"
        stroke="#6B63CC"
        strokeWidth="28"
        strokeLinecap="round"
        pathLength="1"
      />
    </svg>
  )
}
