// src/components/ScoreChart.jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

export default function ScoreChart({ history }) {
  const data = history.map(h => ({
    date: new Date(h.recorded_at).toLocaleDateString(),
    score: h.score
  }))

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
      <h3 className="text-white font-semibold mb-4">Risk Score Drift</h3>
      {data.length === 0 ? (
        <p className="text-slate-500 text-sm">No history yet — run a scan to start tracking.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis dataKey="date" stroke="#718096" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} stroke="#718096" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #4a5568', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <ReferenceLine y={70} stroke="#f56565" strokeDasharray="4 4" label={{ value: 'High', fill: '#f56565', fontSize: 11 }} />
            <ReferenceLine y={35} stroke="#ecc94b" strokeDasharray="4 4" label={{ value: 'Med', fill: '#ecc94b', fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}