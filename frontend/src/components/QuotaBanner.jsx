import { useEffect, useState } from 'react'
import api from '../api/client'

export default function QuotaBanner() {
  const [quota, setQuota] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/quota/').then((r) => setQuota(r.data)).catch(() => setQuota(null))
  }, [])

  if (!quota || dismissed) return null

  const { full_scans_remaining, remaining, limit, resets_at, exhausted, search_units_remaining } = quota
  const usedPct = Math.round(((limit - remaining) / limit) * 100)
  const resetTime = new Date(resets_at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  })

  const barColor = exhausted || search_units_remaining <= 10
    ? 'var(--risk-high)'
    : search_units_remaining <= 25
    ? 'var(--risk-medium)'
    : 'var(--accent)'

  const textColor = exhausted || search_units_remaining <= 10
    ? '#f87171'
    : search_units_remaining <= 25
    ? '#fbbf24'
    : 'var(--mid)'

  const bgStyle = exhausted
    ? { background: 'rgba(240,68,56,0.06)', borderColor: 'rgba(240,68,56,0.15)' }
    : { background: 'rgba(255,255,255,0.02)', borderColor: 'var(--line)' }

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
      <span className="font-medium whitespace-nowrap" style={{ color: 'var(--mid)' }}>
        Search quota
      </span>

      {/* Progress bar */}
      <div
        className="flex-1 rounded-full h-1 min-w-[40px]"
        style={{ background: 'var(--line)' }}
      >
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${usedPct}%`, background: barColor }}
        />
      </div>

      {/* Stats */}
      <span className="whitespace-nowrap tabular-nums" style={{ color: 'var(--lo)' }}>
        {limit - remaining}/{limit}
      </span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <span className="font-semibold whitespace-nowrap tabular-nums" style={{ color: textColor }}>
        {search_units_remaining} units left
      </span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <span className="whitespace-nowrap" style={{ color: 'var(--lo)' }}>
        ~{full_scans_remaining} scans
      </span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <span className="whitespace-nowrap" style={{ color: 'var(--lo)' }}>
        resets {resetTime} UTC
      </span>

      {exhausted && (
        <>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span className="whitespace-nowrap font-medium" style={{ color: '#f87171' }}>
            standard scans still available
          </span>
        </>
      )}

      {!exhausted && search_units_remaining <= 12 && (
        <>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span className="whitespace-nowrap font-medium" style={{ color: '#fbbf24' }}>
            running low
          </span>
        </>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto shrink-0 transition-colors duration-150"
        style={{ color: 'var(--lo)' }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--mid)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--lo)'}
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}
