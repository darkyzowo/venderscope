const SEV = {
  CRITICAL: { color: '#ff4444', bg: 'rgba(255,68,68,0.06)',  border: 'rgba(255,68,68,0.12)'  },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.12)' },
  MEDIUM:   { color: '#eab308', bg: 'rgba(234,179,8,0.05)',  border: 'rgba(234,179,8,0.1)'   },
  LOW:      { color: '#22c55e', bg: 'rgba(34,197,94,0.04)',  border: 'rgba(34,197,94,0.09)'  },
}

const getCVELink = (title) => {
  const id = title?.split(' ')[0]
  return id?.startsWith('CVE-') ? `https://nvd.nist.gov/vuln/detail/${id}` : null
}

// Compact horizontal severity pill: [● CRITICAL]
const SeverityBadge = ({ severity }) => {
  const cfg = SEV[severity] || SEV.LOW
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 whitespace-nowrap"
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cfg.color }}
      />
      {severity}
    </span>
  )
}

export default function EventFeed({ events }) {
  if (!events.length)
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: '#44445a' }}>No risk events detected yet.</p>
      </div>
    )

  return (
    <div className="space-y-1.5">
      {events.map((evt) => {
        const cfg = SEV[evt.severity] || SEV.LOW
        const cveLink = getCVELink(evt.title)

        return (
          <div
            key={evt.id}
            className="rounded-lg p-3.5"
            style={{
              background: cfg.bg,
              // Thin border all-round, thicker accent on the left
              borderTop:    `1px solid ${cfg.border}`,
              borderRight:  `1px solid ${cfg.border}`,
              borderBottom: `1px solid ${cfg.border}`,
              borderLeft:   `3px solid ${cfg.color}`,
            }}
          >
            {/* Title row: text left, severity badge right */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <span
                className="text-[13px] font-medium leading-snug flex-1 min-w-0"
                style={{ color: '#f0f0ff' }}
              >
                {cveLink ? (
                  <a
                    href={cveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline underline-offset-2 transition-opacity hover:opacity-75"
                  >
                    {evt.title}
                    <svg
                      className="inline ml-1 mb-0.5"
                      width="9" height="9" viewBox="0 0 10 10" fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 8L8 2M8 2H4M8 2V6"
                        stroke="currentColor" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                ) : evt.title}
              </span>

              <SeverityBadge severity={evt.severity} />
            </div>

            {/* Description */}
            {evt.description && (
              <p
                className="text-xs leading-relaxed line-clamp-2 mb-1.5"
                style={{ color: '#8888aa' }}
              >
                {evt.description}
              </p>
            )}

            {/* Meta: source · date */}
            <div
              className="flex items-center gap-2 text-[10px] font-mono"
              style={{ color: '#44445a' }}
            >
              <span>{evt.source}</span>
              <span style={{ color: '#2a2a4a' }}>·</span>
              <span>
                {new Date(evt.detected_at).toLocaleDateString([], {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
