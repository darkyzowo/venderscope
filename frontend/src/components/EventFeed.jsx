import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

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
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
      {severity}
    </span>
  )
}

const AcceptedBadge = ({ acceptance }) => {
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const badgeRef = useRef(null)
  const expiryDate = new Date(acceptance.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

  const handleMouseEnter = () => {
    if (badgeRef.current) {
      const r = badgeRef.current.getBoundingClientRect()
      setPos({
        top:   r.top,                      // top of badge in viewport
        right: window.innerWidth - r.right, // right-aligned with badge
      })
    }
    setHovered(true)
  }

  /*
   * Portal: mounts the tooltip DOM node directly under <body>, completely
   * outside the Risk Events panel which holds transform: translateY(0) after
   * its fade-up animation completes. Any ancestor CSS transform makes
   * position:fixed children relative to that element rather than the viewport —
   * portalling out is the only reliable escape.
   *
   * Positioning: top = badge's viewport top, then translateY(calc(-100% - 8px))
   * shifts the tooltip fully above the badge with an 8px gap.
   */
  const tooltip = createPortal(
    <div
      style={{
        position:   'fixed',
        top:        pos.top,
        right:      pos.right,
        width:      256,
        background: '#141425',
        border:     '1px solid #2a2a4a',
        borderRadius: 12,
        padding:    '12px 14px',
        color:      '#b8b8d0',
        fontSize:   12,
        boxShadow:  '0 8px 40px rgba(0,0,0,0.85)',
        zIndex:     9999,
        pointerEvents: 'none',
        opacity:    hovered ? 1 : 0,
        transform:  hovered
          ? 'translateY(calc(-100% - 8px))'
          : 'translateY(calc(-100% - 4px))',
        transition: 'opacity 140ms ease, transform 140ms ease',
      }}
    >
      <p style={{ color: '#fbbf24', fontWeight: 600, marginBottom: 4 }}>Risk Accepted</p>
      <p style={{ color: '#f0f0ff', fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>{acceptance.justification}</p>
      <p style={{ fontSize: 10 }}>Reviewer: <span style={{ color: '#f0f0ff' }}>{acceptance.reviewer}</span></p>
      <p style={{ fontSize: 10, marginTop: 2 }}>Expires: <span style={{ color: '#f0f0ff' }}>{expiryDate}</span></p>
    </div>,
    document.body
  )

  return (
    <span className="inline-block shrink-0">
      <span
        ref={badgeRef}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider whitespace-nowrap cursor-help"
        style={{
          background: 'rgba(251,191,36,0.08)',
          color: '#fbbf24',
          border: '1px solid rgba(251,191,36,0.25)',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#fbbf24' }} />
        ACCEPTED
      </span>
      {tooltip}
    </span>
  )
}

const DEFAULT_EXPIRY = () => {
  const d = new Date()
  d.setDate(d.getDate() + 90)
  return d.toISOString().split('T')[0]
}

export default function EventFeed({ events, acceptances = [], onAccept, onRevoke }) {
  const [expandedEvent, setExpandedEvent] = useState(null)
  const [formState, setFormState] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (!events.length)
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: '#8080aa' }}>No risk events detected yet.</p>
      </div>
    )

  const getAcceptance = (eventId) =>
    acceptances.find((a) => a.event_id === eventId && a.is_active)

  const getForm = (eventId) =>
    formState[eventId] || { justification: '', reviewer: '', expires_at: DEFAULT_EXPIRY(), finding_type: 'CVE' }

  const setForm = (eventId, patch) =>
    setFormState((s) => ({ ...s, [eventId]: { ...getForm(eventId), ...patch } }))

  const handleAccept = async (evt) => {
    const form = getForm(evt.id)
    if (!form.justification.trim() || !form.reviewer.trim()) return
    setSubmitting(true)
    try {
      await onAccept(evt.id, {
        event_id:      evt.id,
        finding_ref:   evt.title.split(' ')[0] || evt.title,
        finding_type:  form.finding_type,
        justification: form.justification,
        reviewer:      form.reviewer,
        expires_at:    new Date(form.expires_at).toISOString(),
      })
      setExpandedEvent(null)
      setFormState((s) => { const n = { ...s }; delete n[evt.id]; return n })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-1.5">
      {events.map((evt) => {
        const cfg = SEV[evt.severity] || SEV.LOW
        const cveLink = getCVELink(evt.title)
        const acceptance = getAcceptance(evt.id)
        const isExpanded = expandedEvent === evt.id
        const form = getForm(evt.id)

        return (
          <div
            key={evt.id}
            className="rounded-lg overflow-hidden"
            style={{
              borderTop:    `1px solid ${acceptance ? 'rgba(251,191,36,0.2)' : cfg.border}`,
              borderRight:  `1px solid ${acceptance ? 'rgba(251,191,36,0.2)' : cfg.border}`,
              borderBottom: `1px solid ${acceptance ? 'rgba(251,191,36,0.2)' : cfg.border}`,
              borderLeft:   `3px solid ${acceptance ? '#fbbf24' : cfg.color}`,
              opacity: acceptance ? 0.75 : 1,
              transition: 'opacity 200ms ease',
            }}
          >
            {/* Main event row */}
            <div
              className="p-3.5"
              style={{ background: acceptance ? 'rgba(251,191,36,0.03)' : cfg.bg }}
            >
              {/* Title row */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 mb-1.5">
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
                      <svg className="inline ml-1 mb-0.5" width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  ) : evt.title}
                </span>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {acceptance ? (
                    <>
                      <AcceptedBadge acceptance={acceptance} />
                      {onRevoke && (
                        <button
                          onClick={() => onRevoke(acceptance.id)}
                          className="text-[9px] px-1.5 py-0.5 rounded transition-colors duration-150"
                          style={{ color: '#8080aa', background: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#8080aa'}
                          title="Revoke acceptance"
                        >
                          ✕
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <SeverityBadge severity={evt.severity} />
                      {onAccept && (
                        <button
                          onClick={() => setExpandedEvent(isExpanded ? null : evt.id)}
                          className="text-[9px] px-2 py-0.5 rounded transition-all duration-150 shrink-0"
                          style={{
                            background: isExpanded ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
                            border: isExpanded ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.07)',
                            color: isExpanded ? '#fbbf24' : '#8080aa',
                          }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.color = '#fbbf24'
                              e.currentTarget.style.borderColor = 'rgba(251,191,36,0.2)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.color = '#8080aa'
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                            }
                          }}
                        >
                          Accept Risk
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              {evt.description && (
                <p className="text-xs leading-relaxed line-clamp-2 mb-1.5" style={{ color: '#b8b8d0' }}>
                  {evt.description}
                </p>
              )}

              {/* Meta: source · date */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono" style={{ color: '#8080aa' }}>
                <span>{evt.source}</span>
                <span style={{ color: '#44445a' }}>·</span>
                <span>
                  {new Date(evt.detected_at).toLocaleDateString([], {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Accept form — slides open */}
            {isExpanded && (
              <div
                style={{
                  background: '#0d0d1c',
                  borderTop: '1px solid #1e1e35',
                  animation: 'fade-up 200ms cubic-bezier(0.16,1,0.3,1) both',
                }}
                className="p-3.5"
              >
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: '#fbbf24' }}>
                  Document Risk Acceptance
                </p>

                <textarea
                  value={form.justification}
                  onChange={(e) => setForm(evt.id, { justification: e.target.value })}
                  placeholder="Justification — why is this risk accepted? (required)"
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-lg px-3 py-2 text-xs resize-none mb-2"
                  style={{
                    background: '#141425',
                    border: '1px solid #2a2a4a',
                    color: '#f0f0ff',
                    outline: 'none',
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={form.reviewer}
                    onChange={(e) => setForm(evt.id, { reviewer: e.target.value })}
                    placeholder="Reviewer name (required)"
                    maxLength={100}
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: '#141425',
                      border: '1px solid #2a2a4a',
                      color: '#f0f0ff',
                      outline: 'none',
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] shrink-0" style={{ color: '#8080aa' }}>Expires</label>
                    <input
                      type="date"
                      value={form.expires_at}
                      onChange={(e) => setForm(evt.id, { expires_at: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 rounded-lg px-2 py-2 text-xs"
                      style={{
                        background: '#141425',
                        border: '1px solid #2a2a4a',
                        color: '#f0f0ff',
                        outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleAccept(evt)}
                    disabled={submitting || !form.justification.trim() || !form.reviewer.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-40"
                    style={{ background: '#fbbf24', color: '#000' }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = '#f59e0b' }}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fbbf24'}
                  >
                    {submitting ? 'Saving…' : 'Accept Risk'}
                  </button>
                  <button
                    onClick={() => setExpandedEvent(null)}
                    className="px-3 py-2 rounded-lg text-xs transition-all duration-150"
                    style={{ color: '#8080aa', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#b8b8d0'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#8080aa'}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
