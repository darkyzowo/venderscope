import { useEffect, useState } from 'react'

const riskColor = (s) => {
  if (s >= 70) return 'var(--risk-high)'
  if (s >= 35) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

const riskLabel = (s) => {
  if (s >= 70) return 'HIGH RISK'
  if (s >= 35) return 'MEDIUM RISK'
  return 'LOW RISK'
}

// Semicircle gauge: arc from (35,62) to (145,62) curving upward
// Center (90,62), radius 55 — text sits cleanly below arc endpoints in SVG space
// Using SVG <text> instead of absolutely-positioned HTML to avoid overlap entirely
export default function ScoreGauge({ score = 0 }) {
  const [fill, setFill] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setFill(score), 120)
    return () => clearTimeout(t)
  }, [score])

  const color = riskColor(score)
  const label = riskLabel(score)

  return (
    <div className="select-none" aria-label={`Risk score: ${score}`}>
      <svg
        width="180"
        height="130"
        viewBox="0 0 180 130"
        aria-hidden="true"
      >
        {/* Track */}
        <path
          d="M35,62 A55,55 0 0 1 145,62"
          fill="none"
          stroke="var(--line)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Animated fill — pathLength=100 maps score directly to offset */}
        <path
          d="M35,62 A55,55 0 0 1 145,62"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - fill}
          style={{
            transition: 'stroke-dashoffset 900ms cubic-bezier(0.34,1.2,0.64,1)',
            filter: `drop-shadow(0 0 5px ${color}44)`,
          }}
        />

        {/* Scale labels */}
        <text x="28"  y="78" fill="var(--border)" fontSize="9" fontFamily="monospace" textAnchor="middle">0</text>
        <text x="152" y="78" fill="var(--border)" fontSize="9" fontFamily="monospace" textAnchor="middle">100</text>

        {/* Score number — baseline at y=106, well below arc endpoints at y=62 */}
        <text
          x="90"
          y="106"
          fill={color}
          fontSize="46"
          fontWeight="700"
          fontFamily="Geist, system-ui, sans-serif"
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {score}
        </text>

        {/* Risk label — sits below score */}
        <text
          x="90"
          y="124"
          fill={color}
          fontSize="9"
          fontWeight="700"
          fontFamily="Geist, system-ui, sans-serif"
          textAnchor="middle"
          letterSpacing="2"
          opacity="0.6"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}
