import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVendors, getVendorEvents, getScoreHistory, scanVendor, exportPDF, setVendorContext } from '../api/client'
import api from '../api/client'
import ScoreChart from '../components/ScoreChart'
import EventFeed from '../components/EventFeed'
import CompliancePanel from '../components/CompliancePanel'
import QuotaBanner from '../components/QuotaBanner'
import ScoreGauge from '../components/ScoreGauge'
import VendorAvatar from '../components/VendorAvatar'

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const EVENTS_SHOWN = 10

const SENSITIVITY_OPTIONS = [
  { value: 'none',      label: 'No Data Access',          hint: '0.8×' },
  { value: 'standard',  label: 'Standard / Unknown',      hint: '1.0×' },
  { value: 'pii',       label: 'PII / Personal Data',     hint: '1.4×' },
  { value: 'financial', label: 'Financial / Payment',     hint: '1.6×' },
  { value: 'auth',      label: 'Authentication / SSO',    hint: '1.6×' },
  { value: 'health',    label: 'Health / Medical',        hint: '1.8×' },
  { value: 'critical',  label: 'Critical Infrastructure', hint: '2.0×' },
]

const parseEPSS = (desc) => {
  const m = desc?.match(/\[EPSS: ([\d.]+)%/)
  return m ? parseFloat(m[1]) : 0
}

const sortEvents = (evts) =>
  [...evts].sort((a, b) => {
    const d = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
    return d !== 0 ? d : parseEPSS(b.description) - parseEPSS(a.description)
  })

// Reusable panel wrapper
const Panel = ({ children, className = '', style: extraStyle }) => (
  <div
    className={`rounded-xl p-6 ${className}`}
    style={{
      background: 'linear-gradient(160deg, #0f0f1e 0%, #0a0a15 100%)',
      border: '1px solid #1e1e35',
      boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
      ...extraStyle,
    }}
  >
    {children}
  </div>
)

const PanelTitle = ({ children, meta }) => (
  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#f0f0ff' }}>
    {children}
    {meta && (
      <span className="text-xs font-normal" style={{ color: '#44445a' }}>{meta}</span>
    )}
  </h3>
)

export default function VendorDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [vendor, setVendor] = useState(null)
  const [events, setEvents] = useState([])
  const [history, setHistory] = useState([])
  const [scanning, setScan] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [quotaExhausted, setQuotaEx] = useState(false)
  const [updatingContext, setUpdatingContext] = useState(false)

  const fetchData = async () => {
    const [vRes, eRes, hRes] = await Promise.all([
      getVendors(), getVendorEvents(id), getScoreHistory(id),
    ])
    setVendor(vRes.data.find((v) => v.id === id))
    setEvents(sortEvents(eRes.data))
    setHistory(hRes.data)
  }

  useEffect(() => {
    async function load() {
      const [vRes, eRes, hRes] = await Promise.all([
        getVendors(), getVendorEvents(id), getScoreHistory(id),
      ])
      setVendor(vRes.data.find((v) => v.id === id))
      setEvents(sortEvents(eRes.data))
      setHistory(hRes.data)
    }
    load()
    api.get('/quota').then((r) => setQuotaEx(r.data.exhausted)).catch(() => {})
  }, [id])

  const handleScan = async () => {
    setScan(true)
    try {
      await scanVendor(id)
      await fetchData()
      api.get('/quota/').then((r) => setQuotaEx(r.data.exhausted)).catch(() => {})
    } catch (e) { console.error('Scan failed:', e) }
    finally { setScan(false) }
  }

  const handleContextChange = async (sensitivity) => {
    setUpdatingContext(true)
    try {
      await setVendorContext(id, sensitivity)
      await fetchData()
    } catch (e) { console.error('Context update failed:', e) }
    finally { setUpdatingContext(false) }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const res = await exportPDF(vendor.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vendorscope_${vendor.name.replace(/\s+/g, '_').toLowerCase()}_report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error('PDF export failed:', e) }
    finally { setExporting(false) }
  }

  // Skeleton loading state — matches actual page layout
  if (!vendor)
    return (
      <div className="min-h-screen animate-page" style={{ background: '#090911' }}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Back placeholder */}
          <div className="skeleton h-4 w-20 mb-6 rounded" />
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="skeleton w-12 h-12 rounded-xl" />
              <div>
                <div className="skeleton h-7 w-40 mb-2 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="skeleton h-9 w-24 rounded-xl" />
              <div className="skeleton h-9 w-24 rounded-xl" />
            </div>
          </div>
          {/* Hero panels */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="skeleton md:col-span-2 h-64 rounded-xl" />
            <div className="skeleton md:col-span-3 h-64 rounded-xl" />
          </div>
          {/* Lower panels */}
          <div className="skeleton h-32 rounded-xl mb-4" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    )

  const displayedEvents = events.slice(0, EVENTS_SHOWN)
  const hiddenCount = events.length - EVENTS_SHOWN

  return (
    <div className="min-h-screen animate-page" style={{ background: '#090911' }}>
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Back */}
        <button
          onClick={() => nav('/')}
          className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors duration-150"
          style={{ color: '#44445a' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#8888aa'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#44445a'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>

        {/* Quota */}
        <div className="mb-6"><QuotaBanner /></div>

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <VendorAvatar name={vendor.name} size={48} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#f0f0ff' }}>{vendor.name}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#44445a' }}>{vendor.domain}</p>
              {vendor.company_number && (
                <p className="text-xs mt-0.5" style={{ color: '#2a2a4a' }}>CH: {vendor.company_number}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleScan}
              disabled={scanning || quotaExhausted}
              title={quotaExhausted ? 'Daily scan quota exhausted — resets at midnight UTC' : ''}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40"
              style={{ background: '#8b5cf6', color: '#fff' }}
              onMouseEnter={(e) => {
                if (!scanning && !quotaExhausted) e.currentTarget.style.background = '#7c3aed'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#8b5cf6' }}
            >
              {scanning ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                  </svg>
                  Scanning…
                </span>
              ) : quotaExhausted ? 'Quota Exhausted' : 'Scan Now'}
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-sm transition-all duration-150"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#8888aa',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!exporting) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = '#f0f0ff'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = '#8888aa'
              }}
            >
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Hero: gauge + chart */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4" style={{ animation: 'fade-up 420ms cubic-bezier(0.16,1,0.3,1) 60ms both' }}>
          {/* Score gauge panel */}
          <Panel className="md:col-span-2 flex flex-col items-center justify-center py-6">
            <ScoreGauge score={vendor.effective_score ?? vendor.risk_score} />

            {/* Effective vs technical scores */}
            {vendor.effective_score != null && vendor.effective_score !== vendor.risk_score && (
              <p className="text-[10px] mt-1 tabular-nums" style={{ color: '#44445a' }}>
                Technical: {vendor.risk_score} → Effective: {vendor.effective_score}
              </p>
            )}

            <div className="mt-4 text-center">
              <p className="text-[11px]" style={{ color: '#44445a' }}>
                {vendor.last_scanned
                  ? `Last scanned · ${new Date(vendor.last_scanned).toLocaleString([], {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}`
                  : 'Never scanned'}
              </p>
              {/* Score calculation tooltip */}
              <div className="group relative inline-block mt-1">
                <span
                  className="text-[11px] cursor-help"
                  style={{ color: '#44445a', borderBottom: '1px dotted #44445a' }}
                >
                  How is this calculated?
                </span>
                <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-80 rounded-xl p-4 text-xs hidden group-hover:block z-50"
                  style={{
                    background: '#141425',
                    border: '1px solid #2a2a4a',
                    color: '#8888aa',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                  }}
                >
                  <p className="font-semibold mb-1.5" style={{ color: '#f0f0ff' }}>Technical Score</p>
                  <p className="mb-3">
                    Top 10 CVEs weighted by severity (CRITICAL=25, HIGH=15, MEDIUM=7, LOW=2),
                    plus breach data from HIBP, Companies House signals, and Shodan exposure. Capped at 100.
                  </p>
                  <p className="font-semibold mb-1.5" style={{ color: '#f0f0ff' }}>Effective Exposure</p>
                  <p className="mb-2">
                    Applies a business context multiplier based on what data this vendor can access.
                    A payment processor with a CRITICAL CVE poses far more risk than a marketing tool with the same CVE.
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2" style={{ borderTop: '1px solid #2a2a4a' }}>
                    {[
                      ['No Data Access', '×0.8'],
                      ['PII / Personal', '×1.4'],
                      ['Financial', '×1.6'],
                      ['Auth / SSO', '×1.6'],
                      ['Health / Medical', '×1.8'],
                      ['Critical Infra', '×2.0'],
                    ].map(([lbl, mult]) => (
                      <div key={lbl} className="flex justify-between">
                        <span>{lbl}</span>
                        <span style={{ color: '#a78bfa' }}>{mult}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2.5" style={{ color: '#a78bfa' }}>Full PDF contains all detected events.</p>
                </div>
              </div>
            </div>

            {/* Data sensitivity selector */}
            <div className="mt-5 w-full" style={{ opacity: updatingContext ? 0.5 : 1, transition: 'opacity 200ms ease', pointerEvents: updatingContext ? 'none' : 'auto' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: '#2a2a4a' }}>
                  Data Sensitivity
                </p>
                {updatingContext && (
                  <span className="text-[9px]" style={{ color: '#44445a' }}>saving…</span>
                )}
              </div>

              {/* Reset / default option — full width, dashed when unset */}
              {(() => {
                const current = vendor.data_sensitivity || 'standard'
                const isDefault = current === 'standard'
                return (
                  <>
                    <button
                      onClick={() => handleContextChange('standard')}
                      className="w-full mb-2 py-1.5 px-3 rounded-lg text-[11px] flex items-center justify-between"
                      style={{
                        background: isDefault ? 'rgba(139,92,246,0.1)' : 'transparent',
                        border: isDefault ? '1px solid rgba(139,92,246,0.3)' : '1px dashed #2a2a4a',
                        color: isDefault ? '#a78bfa' : '#44445a',
                        transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
                        cursor: isDefault ? 'default' : 'pointer',
                      }}
                    >
                      <span className="font-medium">No adjustment</span>
                      <span style={{ opacity: 0.6, fontSize: '10px' }}>default · 1.0×</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      {SENSITIVITY_OPTIONS.filter((o) => o.value !== 'standard').map(({ value, label, hint }) => {
                        const isSelected = current === value
                        return (
                          <button
                            key={value}
                            onClick={() => handleContextChange(value)}
                            className="py-2 px-2.5 rounded-lg text-left"
                            style={{
                              background: isSelected ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)',
                              border: isSelected ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.05)',
                              color: isSelected ? '#a78bfa' : '#44445a',
                              cursor: isSelected ? 'default' : 'pointer',
                              transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                                e.currentTarget.style.color = '#8888aa'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
                                e.currentTarget.style.color = '#44445a'
                              }
                            }}
                          >
                            <div className="text-[10px] font-medium leading-tight">{label}</div>
                            <div className="text-[9px] mt-0.5" style={{ color: isSelected ? 'rgba(167,139,250,0.6)' : '#2a2a4a' }}>{hint}</div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
          </Panel>

          {/* Score history chart */}
          <div className="md:col-span-3">
            <ScoreChart history={history} />
          </div>
        </div>

        {/* Vendor Profile */}
        {(vendor.description || vendor.auth_method || vendor.two_factor) && (
          <Panel className="mb-4" style={{ animation: 'fade-up 420ms cubic-bezier(0.16,1,0.3,1) 140ms both' }}>
            <PanelTitle meta="(auto-discovered)">Vendor Profile</PanelTitle>
            {vendor.description && (
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#8888aa' }}>
                {vendor.description}
              </p>
            )}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#44445a' }}>
                  Auth Method
                </p>
                <p className="text-sm" style={{ color: '#8888aa' }}>
                  {vendor.auth_method || (
                    <span style={{ color: '#2a2a4a' }}>Not detected</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#44445a' }}>
                  2FA Support
                </p>
                {vendor.two_factor === 'Yes' ? (
                  <span
                    className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      color: '#22c55e',
                    }}
                  >
                    Yes
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: '#2a2a4a' }}>Not detected</span>
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* Compliance */}
        <Panel className="mb-4" style={{ animation: 'fade-up 420ms cubic-bezier(0.16,1,0.3,1) 200ms both' }}>
          <PanelTitle meta="(auto-discovered from public sources)">Compliance Posture</PanelTitle>
          <CompliancePanel compliance={vendor.compliance} />
        </Panel>

        {/* Risk Events */}
        <Panel style={{ animation: 'fade-up 420ms cubic-bezier(0.16,1,0.3,1) 260ms both' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: '#f0f0ff' }}>
              Risk Events{' '}
              <span className="font-normal" style={{ color: '#44445a' }}>
                (top {displayedEvents.length} of {events.length})
              </span>
            </h3>
            {hiddenCount > 0 && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="text-xs rounded-full px-3 py-1 transition-colors duration-150"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  color: '#a78bfa',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139,92,246,0.18)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
              >
                +{hiddenCount} more in PDF
              </button>
            )}
          </div>
          <EventFeed events={displayedEvents} />
        </Panel>

      </div>
    </div>
  )
}
