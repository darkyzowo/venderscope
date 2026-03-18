// src/components/ScoreChart.jsx
import {
  AreaChart, Area, XAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  const color = score >= 70 ? '#f87171' : score >= 35 ? '#facc15' : '#4ade80'
  return (
    <div style={{
      background: '#0f1117',
      border: '1px solid #334155',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    }}>
      <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{score}</p>
      <p style={{ color: '#475569', fontSize: 10, marginTop: 3 }}>risk score</p>
    </div>
  )
}

export default function ScoreChart({ history }) {
  const data = history.map(h => ({
    date: new Date(h.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    score: h.score
  }))

  const latest = data[data.length - 1]?.score ?? null
  const scoreColor = latest >= 70 ? 'text-red-400' : latest >= 35 ? 'text-yellow-400' : 'text-green-400'
  const scoreHex   = latest >= 70 ? '#f87171'      : latest >= 35 ? '#facc15'      : '#4ade80'

  const header = (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="text-white font-semibold">Risk Score Drift</h3>
        {latest !== null && (
          <p className="text-slate-500 text-xs mt-0.5">
            Latest: <span className={`font-semibold ${scoreColor}`}>{latest}</span>
          </p>
        )}
      </div>
      {/* Legend — lives outside the chart so it never overlaps */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5 select-none">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#f87171" strokeWidth="1.5" strokeDasharray="3 2" strokeOpacity="0.7" />
          </svg>
          High ≥70
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3 2" strokeOpacity="0.7" />
          </svg>
          Med ≥35
        </span>
      </div>
    </div>
  )

  // No data at all
  if (data.length === 0) {
    return (
      <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
        {header}
        <p className="text-slate-500 text-sm py-8 text-center">
          No history yet — run a scan to start tracking.
        </p>
      </div>
    )
  }

  // Single data point — chart would be meaningless, show a score card instead
  if (data.length === 1) {
    return (
      <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
        {header}
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-5xl font-bold tabular-nums" style={{ color: scoreHex }}>
            {latest}
          </span>
          <p className="text-slate-500 text-sm">First scan recorded</p>
          <p className="text-slate-600 text-xs">Scan again to begin tracking drift over time</p>
        </div>
      </div>
    )
  }

  // 2+ data points — render the full chart
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
      {header}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#475569', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          {/* No YAxis — reference lines + header legend provide the scale context */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#334155', strokeWidth: 1 }}
          />
          <ReferenceLine y={70} stroke="#f87171" strokeDasharray="4 3" strokeOpacity={0.45} />
          <ReferenceLine y={35} stroke="#facc15" strokeDasharray="4 3" strokeOpacity={0.45} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#scoreGrad)"
            dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
