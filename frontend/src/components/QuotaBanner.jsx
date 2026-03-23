import { useEffect, useState } from 'react'
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://venderscope-api.onrender.com/api',
})

export default function QuotaBanner() {
  const [quota, setQuota] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/quota/').then((r) => setQuota(r.data)).catch(() => setQuota(null))
  }, [])

  if (!quota || dismissed) return null

  const { full_scans_remaining, remaining, limit, resets_at, exhausted } = quota
  const usedPct = Math.round(((limit - remaining) / limit) * 100)
  const resetTime = new Date(resets_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  })

  const barColor = exhausted || full_scans_remaining <= 1
    ? '#ef4444'
    : full_scans_remaining <= 3
    ? '#eab308'
    : '#8b5cf6'

  const textColor = exhausted || full_scans_remaining <= 1
    ? '#f87171'
    : full_scans_remaining <= 3
    ? '#fbbf24'
    : '#8888aa'

  const bgStyle = exhausted
    ? { background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }
    : { background: 'rgba(255,255,255,0.02)', borderColor: '#1e1e35' }

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs"
      style={{ border: '1px solid', ...bgStyle, transition: 'all 200ms ease' }}
    >
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: barColor,
          boxShadow: exhausted ? `0 0 6px ${barColor}` : 'none',
        }}
      />

      {/* Label */}
      <span className="font-medium whitespace-nowrap" style={{ color: '#8888aa' }}>
        CSE quota
      </span>

      {/* Progress bar */}
      <div
        className="flex-1 rounded-full h-1 min-w-[40px]"
        style={{ background: '#1e1e35' }}
      >
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${usedPct}%`, background: barColor }}
        />
      </div>

      {/* Stats */}
      <span className="whitespace-nowrap tabular-nums" style={{ color: '#44445a' }}>
        {limit - remaining}/{limit}
      </span>
      <span style={{ color: '#2a2a4a' }}>·</span>
      <span className="font-semibold whitespace-nowrap tabular-nums" style={{ color: textColor }}>
        {full_scans_remaining} left
      </span>
      <span style={{ color: '#2a2a4a' }}>·</span>
      <span className="whitespace-nowrap" style={{ color: '#44445a' }}>
        resets {resetTime} UTC
      </span>

      {exhausted && (
        <>
          <span style={{ color: '#2a2a4a' }}>·</span>
          <span className="whitespace-nowrap font-medium" style={{ color: '#f87171' }}>
            standard scans still available
          </span>
        </>
      )}

      {!exhausted && full_scans_remaining <= 2 && (
        <>
          <span style={{ color: '#2a2a4a' }}>·</span>
          <span className="whitespace-nowrap font-medium" style={{ color: '#fbbf24' }}>
            running low
          </span>
        </>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto shrink-0 transition-colors duration-150"
        style={{ color: '#2a2a4a' }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#8888aa'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#2a2a4a'}
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}
