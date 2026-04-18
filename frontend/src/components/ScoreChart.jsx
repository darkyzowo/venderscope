import { useId, useMemo, useState } from 'react'

const SVG_WIDTH = 640
const SVG_HEIGHT = 200
const PADDING = { top: 8, right: 10, bottom: 28, left: 10 }
const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right
const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom
const HIGH_RISK_Y = 70
const MEDIUM_RISK_Y = 40

const riskHex = (score) => (score >= HIGH_RISK_Y ? '#f97316' : score >= MEDIUM_RISK_Y ? '#eab308' : '#22c55e')

function clampScore(score) {
  return Math.max(0, Math.min(100, Number(score) || 0))
}

function scoreToY(score) {
  return PADDING.top + (100 - clampScore(score)) * (CHART_HEIGHT / 100)
}

function getBandWidth(points, index) {
  const prevX = index > 0 ? points[index - 1].x : points[index].x
  const nextX = index < points.length - 1 ? points[index + 1].x : points[index].x
  const width = Math.max(28, (nextX - prevX) / 2)
  return Math.min(width, 96)
}

function buildLinePath(points) {
  if (points.length === 0) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

function buildAreaPath(points) {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${buildLinePath(points)} L ${last.x} ${PADDING.top + CHART_HEIGHT} L ${first.x} ${PADDING.top + CHART_HEIGHT} Z`
}

function ChartTooltip({ point }) {
  if (!point) return null
  const color = riskHex(point.score)
  const left = `clamp(12px, calc(${((point.x / SVG_WIDTH) * 100).toFixed(2)}% - 56px), calc(100% - 112px))`

  return (
    <div
      className="pointer-events-none absolute top-2 z-10"
      style={{ left }}
    >
      <div style={{
        background: '#141425',
        border: '1px solid #2a2a4a',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <p style={{ color: '#8080aa', fontSize: 10, marginBottom: 4 }}>{point.date}</p>
        <p style={{ color, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{point.score}</p>
        <p style={{ color: '#8080aa', fontSize: 10, marginTop: 3 }}>risk score</p>
      </div>
    </div>
  )
}

export default function ScoreChart({ history }) {
  const gradientId = useId()
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const data = useMemo(() => history.map((item) => ({
    date: new Date(item.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    score: clampScore(item.score),
  })), [history])

  const points = useMemo(() => {
    if (data.length <= 1) return []
    return data.map((item, index) => {
      const x = PADDING.left + (index * CHART_WIDTH) / (data.length - 1)
      return {
        ...item,
        x,
        y: scoreToY(item.score),
      }
    })
  }, [data])

  const latest = data[data.length - 1]?.score ?? null
  const scoreColor = latest !== null ? riskHex(latest) : '#8888aa'
  const activePoint = hoveredIndex == null ? points[points.length - 1] : points[hoveredIndex]

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: '#f0f0ff' }}>
          Risk Score Drift
        </h3>
        {latest !== null && (
          <p className="text-xs mt-0.5" style={{ color: '#8080aa' }}>
            Latest:{' '}
            <span style={{ color: scoreColor, fontWeight: 600 }}>{latest}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] pt-0.5 select-none" style={{ color: '#8080aa' }}>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 2" strokeOpacity="0.7" />
          </svg>
          High ≥70
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 2" strokeOpacity="0.7" />
          </svg>
          Med ≥40
        </span>
      </div>
    </div>
  )

  const panelStyle = {
    background: 'linear-gradient(160deg, #0f0f1e 0%, #0a0a15 100%)',
    border: '1px solid #1e1e35',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
  }

  if (data.length === 0) {
    return (
      <div style={panelStyle}>
        {header}
        <p className="text-sm py-8 text-center" style={{ color: '#8080aa' }}>
          No history yet — run a scan to start tracking.
        </p>
      </div>
    )
  }

  if (data.length === 1) {
    return (
      <div style={panelStyle}>
        {header}
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-5xl font-bold tabular-nums" style={{ color: scoreColor }}>
            {latest}
          </span>
          <p className="text-sm" style={{ color: '#8080aa' }}>First scan recorded</p>
          <p className="text-xs" style={{ color: '#8080aa' }}>Scan again to begin tracking drift</p>
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {header}
      <div
        className="relative"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <ChartTooltip point={activePoint} />
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full overflow-visible"
          aria-label="Risk score drift chart"
          role="img"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity="0.18" />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect x={PADDING.left} y={PADDING.top} width={CHART_WIDTH} height={CHART_HEIGHT} fill="transparent" />

          {[HIGH_RISK_Y, MEDIUM_RISK_Y].map((threshold) => (
            <line
              key={threshold}
              x1={PADDING.left}
              y1={scoreToY(threshold)}
              x2={PADDING.left + CHART_WIDTH}
              y2={scoreToY(threshold)}
              stroke={threshold === HIGH_RISK_Y ? '#f97316' : '#eab308'}
              strokeDasharray="4 3"
              strokeOpacity="0.4"
            />
          ))}

          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1={PADDING.left}
              y1={PADDING.top + CHART_HEIGHT * fraction}
              x2={PADDING.left + CHART_WIDTH}
              y2={PADDING.top + CHART_HEIGHT * fraction}
              stroke="#1e1e35"
              strokeDasharray="3 3"
            />
          ))}

          <path d={buildAreaPath(points)} fill={`url(#${gradientId})`} />
          <path
            d={buildLinePath(points)}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point, index) => {
            const isActive = index === (hoveredIndex == null ? points.length - 1 : hoveredIndex)
            return (
              <g key={`${point.date}-${index}`}>
                <line
                  x1={point.x}
                  y1={PADDING.top}
                  x2={point.x}
                  y2={PADDING.top + CHART_HEIGHT}
                  stroke="#2a2a4a"
                  strokeWidth="1"
                  opacity={isActive ? 1 : 0}
                />
                <circle cx={point.x} cy={point.y} r={isActive ? 5 : 3} fill={isActive ? '#a78bfa' : '#8b5cf6'} />
                <rect
                  x={point.x - getBandWidth(points, index)}
                  y={PADDING.top}
                  width={getBandWidth(points, index) * 2}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                />
              </g>
            )
          })}

          {points.map((point, index) => (
            <text
              key={`label-${point.date}-${index}`}
              x={point.x}
              y={SVG_HEIGHT - 8}
              fill="#8080aa"
              fontSize="10"
              textAnchor="middle"
            >
              {point.date}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
