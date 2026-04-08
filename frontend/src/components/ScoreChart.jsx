import {
  AreaChart, Area, XAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const riskHex = (s) => s >= 70 ? '#f97316' : s >= 35 ? '#eab308' : '#22c55e'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  const color = riskHex(score)
  return (
    <div style={{
      background: '#141425',
      border: '1px solid #2a2a4a',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{ color: '#8080aa', fontSize: 10, marginBottom: 4 }}>{label}</p>
      <p style={{ color, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{score}</p>
      <p style={{ color: '#8080aa', fontSize: 10, marginTop: 3 }}>risk score</p>
    </div>
  )
}

export default function ScoreChart({ history }) {
  const data = history.map((h) => ({
    date: new Date(h.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    score: h.score,
  }))

  const latest = data[data.length - 1]?.score ?? null
  const scoreColor = latest !== null ? riskHex(latest) : '#8888aa'

  const header = (
    <div className="flex items-start justify-between mb-5">
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
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] pt-0.5 select-none" style={{ color: '#8080aa' }}>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 2" strokeOpacity="0.7"/>
          </svg>
          High ≥70
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 2" strokeOpacity="0.7"/>
          </svg>
          Med ≥35
        </span>
      </div>
    </div>
  )

  const panelStyle = {
    background: 'linear-gradient(160deg, #0f0f1e 0%, #0a0a15 100%)',
    border: '1px solid #1e1e35',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
  }

  if (data.length === 0)
    return (
      <div style={panelStyle}>
        {header}
        <p className="text-sm py-8 text-center" style={{ color: '#8080aa' }}>
          No history yet — run a scan to start tracking.
        </p>
      </div>
    )

  if (data.length === 1)
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

  return (
    <div style={panelStyle}>
      {header}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8080aa', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a2a4a', strokeWidth: 1 }} />
          <ReferenceLine y={70} stroke="#f97316" strokeDasharray="4 3" strokeOpacity={0.4} />
          <ReferenceLine y={35} stroke="#eab308" strokeDasharray="4 3" strokeOpacity={0.4} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#scoreGrad)"
            dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#a78bfa', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
