import { useNavigate } from 'react-router-dom'
import VendorAvatar from './VendorAvatar'

const riskConfig = (s) => {
  if (s >= 70) return {
    color: '#f97316',
    label: 'HIGH RISK',
    border: 'rgba(249,115,22,0.3)',
    hoverBorder: 'rgba(249,115,22,0.5)',
    hoverGlow: 'rgba(249,115,22,0.1)',
  }
  if (s >= 35) return {
    color: '#eab308',
    label: 'MEDIUM',
    border: 'rgba(234,179,8,0.25)',
    hoverBorder: 'rgba(234,179,8,0.45)',
    hoverGlow: 'rgba(234,179,8,0.08)',
  }
  return {
    color: '#22c55e',
    label: 'LOW RISK',
    border: 'rgba(34,197,94,0.2)',
    hoverBorder: 'rgba(34,197,94,0.4)',
    hoverGlow: 'rgba(34,197,94,0.07)',
  }
}

export default function VendorCard({ vendor, onDelete, onScan, scanning }) {
  const nav = useNavigate()
  const cfg = riskConfig(vendor.risk_score)
  const domain = vendor.domain.split('?')[0].split('/')[0]

  const handleMouseEnter = (e) => {
    e.currentTarget.style.borderColor = cfg.hoverBorder
    e.currentTarget.style.boxShadow = `0 0 0 0 transparent, 0 8px 32px ${cfg.hoverGlow}, 0 2px 16px rgba(0,0,0,0.6)`
    e.currentTarget.style.transform = 'translateY(-2px)'
  }
  const handleMouseLeave = (e) => {
    e.currentTarget.style.borderColor = cfg.border
    e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
    e.currentTarget.style.transform = 'translateY(0)'
  }

  return (
    <div
      className="rounded-xl cursor-pointer"
      style={{
        background: 'linear-gradient(160deg, #0f0f1e 0%, #0a0a15 100%)',
        border: `1px solid ${cfg.border}`,
        boxShadow: '0 2px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => nav(`/vendor/${vendor.id}`)}
    >
      <div className="p-5">
        {/* Header: avatar + name + score */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <VendorAvatar name={vendor.name} size={36} />
            <div className="min-w-0">
              <h3
                className="font-semibold text-[15px] leading-tight truncate"
                style={{ color: '#f0f0ff' }}
              >
                {vendor.name}
              </h3>
              <p className="text-xs mt-0.5 truncate" style={{ color: '#44445a' }}>
                {domain}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 ml-3">
            <div
              className="text-3xl font-bold tabular-nums leading-none"
              style={{ color: cfg.color }}
            >
              {vendor.risk_score}
            </div>
            <div
              className="text-[9px] font-bold tracking-[0.12em] mt-0.5"
              style={{ color: cfg.color, opacity: 0.65 }}
            >
              {cfg.label}
            </div>
            {vendor.score_delta != null && vendor.score_delta !== 0 && (
              <div
                className="text-[10px] font-semibold tabular-nums mt-1"
                style={{ color: vendor.score_delta > 0 ? '#ef4444' : '#22c55e' }}
              >
                {vendor.score_delta > 0 ? `+${vendor.score_delta} ↑` : `${vendor.score_delta} ↓`}
              </div>
            )}
          </div>
        </div>

        {/* Hairline divider */}
        <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.04)' }} />

        {/* Timestamp */}
        <p className="text-[11px] mb-3" style={{ color: '#44445a' }}>
          {vendor.last_scanned
            ? new Date(vendor.last_scanned).toLocaleString([], {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : 'Never scanned'}
        </p>

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onScan(vendor.id)}
            disabled={scanning}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-150 disabled:opacity-40"
            style={{
              background: 'rgba(139,92,246,0.1)',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
            onMouseEnter={(e) => {
              if (!scanning) e.currentTarget.style.background = 'rgba(139,92,246,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.1)'
            }}
          >
            {scanning ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <svg
                  className="animate-spin"
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                >
                  <circle
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="3"
                    strokeDasharray="31.4 31.4" strokeLinecap="round"
                  />
                </svg>
                Scanning…
              </span>
            ) : 'Scan Now'}
          </button>

          <button
            onClick={() => onDelete(vendor.id)}
            className="py-2 px-3 rounded-lg text-xs transition-colors duration-150"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#44445a',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
              e.currentTarget.style.color = '#f87171'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = '#44445a'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
            }}
            aria-label="Remove vendor"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
