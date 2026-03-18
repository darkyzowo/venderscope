// src/components/VendorCard.jsx
import { useNavigate } from 'react-router-dom'

const scoreColor = (s) => {
  if (s >= 70) return 'text-red-400 border-red-500'
  if (s >= 35) return 'text-yellow-400 border-yellow-500'
  return 'text-green-400 border-green-500'
}

const scoreBg = (s) => {
  if (s >= 70) return 'bg-red-500/10'
  if (s >= 35) return 'bg-yellow-500/10'
  return 'bg-green-500/10'
}

const scoreLabel = (s) => {
  if (s >= 70) return 'HIGH RISK'
  if (s >= 35) return 'MEDIUM RISK'
  return 'LOW RISK'
}

export default function VendorCard({ vendor, onDelete, onScan, scanning }) {
  const nav = useNavigate()

  return (
    <div
      className={`rounded-xl border p-5 cursor-pointer transition hover:brightness-110 hover:shadow-lg ${scoreBg(vendor.risk_score)} ${scoreColor(vendor.risk_score)}`}
      onClick={() => nav(`/vendor/${vendor.id}`)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-semibold text-lg">{vendor.name}</h3>
          <p className="text-slate-400 text-sm">{vendor.domain.split('?')[0].split('/')[0]}</p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${scoreColor(vendor.risk_score)}`}>
            {vendor.risk_score}
          </div>
          <div className={`text-xs font-semibold tracking-wider ${scoreColor(vendor.risk_score)}`}>
            {scoreLabel(vendor.risk_score)}
          </div>
        </div>
      </div>

      <p className="text-slate-500 text-xs mb-4">
        Last scanned: {vendor.last_scanned
          ? new Date(vendor.last_scanned).toLocaleString()
          : 'Never'}
      </p>

      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onScan(vendor.id)}
          disabled={scanning}
          className="flex-1 text-xs py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition"
        >
          {scanning ? 'Scanning...' : 'Scan Now'}
        </button>
        <button
          onClick={() => onDelete(vendor.id)}
          className="text-xs py-1.5 px-3 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-400 hover:text-white transition"
          aria-label="Remove vendor"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}