// src/components/ScoreChart.jsx
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  const color = score >= 70 ? '#f87171' : score >= 35 ? '#facc15' : '#4ade80'
  return (
    <div style={{ background: '#0f1117', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
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

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold">Risk Score Drift</h3>
          {latest !== null && (
            <p className="text-slate-500 text-xs mt-0.5">
              Latest:{' '}
              <span className={`font-semibold ${scoreColor}`}>{latest}</span>
            </p>
          )}
        </div>
        {/* Legend — lives here so it never overlaps the chart */}
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

      {data.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          No history yet — run a scan to start tracking.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2535"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: '#475569', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#334155', strokeWidth: 1 }}
            />
            {/* Reference lines — no labels inside the chart */}
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
      )}
    </div>
  )
}
