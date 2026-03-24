import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVendors, getVendorEvents, getScoreHistory, scanVendor, exportPDF } from '../api/client'
import api from '../api/client'
import ScoreChart from '../components/ScoreChart'
import EventFeed from '../components/EventFeed'
import CompliancePanel from '../components/CompliancePanel'
import QuotaBanner from '../components/QuotaBanner'
import ScoreGauge from '../components/ScoreGauge'
import VendorAvatar from '../components/VendorAvatar'

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const EVENTS_SHOWN = 10

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
const Panel = ({ children, className = '' }) => (
  <div
    className={`rounded-xl p-6 ${className}`}
    style={{
      background: 'linear-gradient(160deg, #0f0f1e 0%, #0a0a15 100%)',
      border: '1px solid #1e1e35',
      boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
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

  // Loading state
  if (!vendor)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#090911' }}>
        <div className="flex items-center gap-2.5 text-sm" style={{ color: '#44445a' }}>
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
          </svg>
          Loading…
        </div>
      </div>
    )

  const displayedEvents = events.slice(0, EVENTS_SHOWN)
  const hiddenCount = events.length - EVENTS_SHOWN

  return (
    <div className="min-h-screen" style={{ background: '#090911' }}>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          {/* Score gauge panel */}
          <Panel className="md:col-span-2 flex flex-col items-center justify-center py-6">
            <ScoreGauge score={vendor.risk_score} />
            <div className="mt-5 text-center">
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
                  style={{ color: '#2a2a4a', borderBottom: '1px dotted #2a2a4a' }}
                >
                  How is this calculated?
                </span>
                <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72 rounded-xl p-3.5 text-xs hidden group-hover:block z-50"
                  style={{
                    background: '#141425',
                    border: '1px solid #2a2a4a',
                    color: '#8888aa',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                  }}
                >
                  Top 10 CVEs weighted by severity (CRITICAL=25, HIGH=15, MEDIUM=7, LOW=2),
                  plus breach data from HIBP, Companies House signals, and Shodan exposure.
                  Capped at 100.{' '}
                  <span style={{ color: '#a78bfa' }}>Full PDF contains all detected events.</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Score history chart */}
          <div className="md:col-span-3">
            <ScoreChart history={history} />
          </div>
        </div>

        {/* Vendor Profile */}
        {(vendor.description || vendor.auth_method || vendor.two_factor) && (
          <Panel className="mb-4">
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
        <Panel className="mb-4">
          <PanelTitle meta="(auto-discovered from public sources)">Compliance Posture</PanelTitle>
          <CompliancePanel compliance={vendor.compliance} />
        </Panel>

        {/* Risk Events */}
        <Panel>
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
