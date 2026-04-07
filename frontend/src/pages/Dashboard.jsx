import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVendors, addVendor, deleteVendor, scanVendor, getDashboardSummary } from '../api/client'
import VendorCard from '../components/VendorCard'
import AddVendorModal from '../components/AddVendorModal'
import QuotaBanner from '../components/QuotaBanner'
import Footer from '../components/Footer'
import { useAuth } from '../auth/AuthContext'

// Hexagon logo mark — hex outline with inner target
const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z"
      stroke="#8b5cf6" strokeWidth="1.5"
      fill="rgba(139,92,246,0.08)"
    />
    <circle cx="16" cy="16" r="5.5" stroke="#8b5cf6" strokeWidth="1.2" fill="rgba(139,92,246,0.12)" />
    <circle cx="16" cy="16" r="1.8" fill="#8b5cf6" />
    <line x1="16" y1="10.5" x2="16" y2="12.2" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
    <line x1="16" y1="19.8" x2="16" y2="21.5" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
    <line x1="10.5" y1="16" x2="12.2" y2="16" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
    <line x1="19.8" y1="16" x2="21.5" y2="16" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
  </svg>
)

const StatPill = ({ value, label, color }) => (
  <div
    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}
  >
    <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
    <span className="text-sm" style={{ color: '#44445a' }}>{label}</span>
  </div>
)

const EmptyState = ({ onAdd }) => (
  <div className="text-center py-32">
    <div className="flex justify-center mb-4 opacity-15">
      <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
        <path d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z" stroke="#8b5cf6" strokeWidth="1.5" fill="none"/>
        <circle cx="16" cy="16" r="5.5" stroke="#8b5cf6" strokeWidth="1.2"/>
        <circle cx="16" cy="16" r="1.8" fill="#8b5cf6"/>
      </svg>
    </div>
    <p className="font-medium" style={{ color: '#44445a' }}>No vendors monitored yet</p>
    <p className="text-sm mt-1" style={{ color: '#2a2a4a' }}>
      Add your first vendor to start continuous monitoring.
    </p>
    <button
      onClick={onAdd}
      className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
      style={{ background: '#8b5cf6', color: '#fff' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#7c3aed'}
      onMouseLeave={(e) => e.currentTarget.style.background = '#8b5cf6'}
    >
      + Add Vendor
    </button>
  </div>
)

const SORT_OPTIONS = [
  { key: 'risk',    label: 'Risk Score' },
  { key: 'delta',   label: 'Biggest Movers' },
  { key: 'scanned', label: 'Recently Scanned' },
]

export default function Dashboard() {
  const { logout } = useAuth()
  const nav = useNavigate()
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [scanning, setScanning] = useState({})
  const [scanningAll, setScanAll] = useState(false)
  const [cardsVisible, setCardsVisible] = useState(false)
  const [sortBy, setSortBy] = useState('risk')
  const [summary, setSummary] = useState(null)

  const load = () => getVendors().then((r) => setVendors(r.data))

  useEffect(() => {
    load()
    getDashboardSummary().then((r) => setSummary(r.data)).catch(() => {})
    const t = setTimeout(() => setCardsVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const handleAdd = async (data) => { await addVendor(data); await load() }

  const handleDelete = async (id) => {
    if (!confirm('Remove this vendor?')) return
    await deleteVendor(id)
    await load()
  }

  const handleScan = async (id) => {
    setScanning((s) => ({ ...s, [id]: true }))
    try { await scanVendor(id); await load() }
    catch (e) { console.error('Scan failed:', e) }
    finally { setScanning((s) => ({ ...s, [id]: false })) }
  }

  const handleScanAll = async () => {
    setScanAll(true)
    try {
      const current = await getVendors()
      for (const v of current.data) {
        try { await scanVendor(v.id) }
        catch (e) { console.error(`Scan failed for ${v.name}:`, e) }
      }
    } catch (e) { console.error('Scan all failed:', e) }
    finally { setScanAll(false); window.location.reload() }
  }

  const handleExportRegister = () => {
    if (!vendors.length) return
    const headers = [
      'Vendor Name', 'Domain', 'Data Sensitivity', 'Technical Score',
      'Effective Exposure Score', 'Risk Band', 'Score Delta', 'Last Scanned',
      'Review Interval (days)', 'CVE Count', 'Breach Detected', 'Export Date',
    ]
    const riskBand = (s) => s >= 70 ? 'HIGH' : s >= 35 ? 'MEDIUM' : 'LOW'
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = vendors.map((v) => {
      const score = v.effective_score ?? v.risk_score
      return [
        esc(v.name),
        esc(v.domain),
        esc(v.data_sensitivity || 'standard'),
        esc(v.risk_score),
        esc(score),
        esc(riskBand(score)),
        esc(v.score_delta != null ? (v.score_delta > 0 ? `+${v.score_delta}` : v.score_delta) : 'N/A'),
        esc(v.last_scanned ? new Date(v.last_scanned).toLocaleDateString() : 'Never'),
        esc(v.review_interval_days ?? 'None'),
        esc('See vendor report'),
        esc('See vendor report'),
        esc(new Date().toLocaleDateString()),
      ].join(',')
    })
    const csv = [headers.map(esc).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendorscope_risk_register_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const effScore = (v) => v.effective_score ?? v.risk_score
  const high    = vendors.filter((v) => effScore(v) >= 70).length
  const medium  = vendors.filter((v) => effScore(v) >= 35 && effScore(v) < 70).length
  const low     = vendors.filter((v) => effScore(v) < 35).length
  const rising  = vendors.filter((v) => v.score_delta > 0).sort((a, b) => b.score_delta - a.score_delta)

  const sortedVendors = [...vendors].sort((a, b) => {
    if (sortBy === 'risk')    return effScore(b) - effScore(a)
    if (sortBy === 'delta')   return (b.score_delta ?? -Infinity) - (a.score_delta ?? -Infinity)
    if (sortBy === 'scanned') {
      const ta = a.last_scanned ? new Date(a.last_scanned).getTime() : 0
      const tb = b.last_scanned ? new Date(b.last_scanned).getTime() : 0
      return tb - ta
    }
    return 0
  })

  return (
    <div className="min-h-screen" style={{ background: '#090911' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Beta notice */}
        <div className="flex items-center gap-2.5 mb-5 text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold tracking-wide"
            style={{
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(139,92,246,0.15)',
              color: '#a78bfa',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#8b5cf6' }} />
            BETA
          </span>
          <span style={{ color: '#44445a' }}>
            Vendor data is private to your account.
          </span>
          <a
            href="https://github.com/darkyzowo/venderscope"
            target="_blank"
            rel="noreferrer"
            className="ml-auto shrink-0 transition-colors duration-150"
            style={{ color: '#44445a' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#8888aa'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#44445a'}
          >
            GitHub →
          </a>
        </div>

        {/* Quota */}
        <div className="mb-6"><QuotaBanner /></div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none" style={{ color: '#f0f0ff' }}>
                Vender<span style={{ color: '#8b5cf6' }}>Scope</span>
              </h1>
              <p className="text-xs mt-1.5" style={{ color: '#44445a' }}>
                Vendor risk intelligence · continuous monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scan All with tooltip */}
            <div className="relative group">
              <button
                onClick={handleScanAll}
                disabled={scanningAll || vendors.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#8888aa',
                }}
                onMouseEnter={(e) => {
                  if (!scanningAll && vendors.length > 0) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = '#f0f0ff'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = '#8888aa'
                }}
              >
                {scanningAll ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                    </svg>
                    Scanning…
                  </span>
                ) : 'Scan All'}
              </button>
              <div
                className="absolute right-0 top-11 w-72 rounded-xl p-3.5 text-xs hidden group-hover:block z-50"
                style={{
                  background: '#141425',
                  border: '1px solid #2a2a4a',
                  color: '#8888aa',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                }}
              >
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>Heads up:</span>{' '}
                Works best with 1–2 vendors on the free tier. Scanning 3+ can take 3–5 min or time out.{' '}
                <span style={{ color: '#a78bfa' }}>Use Scan Now on individual cards for reliable results.</span>
              </div>
            </div>

            <button
              onClick={handleExportRegister}
              disabled={vendors.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#8888aa',
              }}
              onMouseEnter={(e) => {
                if (vendors.length > 0) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = '#f0f0ff'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = '#8888aa'
              }}
              title="Download risk register as CSV"
            >
              Export Register
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{ background: '#8b5cf6', color: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#7c3aed'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#8b5cf6'}
            >
              + Add Vendor
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl text-sm transition-all duration-150"
              title="Sign out"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#44445a',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ff4444'
                e.currentTarget.style.borderColor = 'rgba(255,68,68,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#44445a'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Stats row */}
        {vendors.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <StatPill value={vendors.length} label="Total" color="#f0f0ff" />
            <StatPill value={high}           label="High Risk" color="#f97316" />
            <StatPill value={medium}         label="Medium" color="#eab308" />
            <StatPill value={low}            label="Low Risk" color="#22c55e" />
            {rising.length > 0 && (
              <StatPill value={rising.length} label="Rising ↑" color="#ef4444" />
            )}
            {summary?.overdue_review_count > 0 && (
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                title={`Overdue: ${summary.overdue_reviews?.map((v) => v.name).join(', ')}`}
                style={{
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  cursor: 'default',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9.5" stroke="#fbbf24" strokeWidth="1.5"/>
                  <path d="M12 7v5l3 3" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xl font-bold tabular-nums" style={{ color: '#fbbf24' }}>
                  {summary.overdue_review_count}
                </span>
                <span className="text-sm" style={{ color: '#92723a' }}>Reviews Due</span>
              </div>
            )}
          </div>
        )}

        {/* Needs Attention */}
        {rising.length > 0 && (
          <div className="mb-8 rounded-xl p-4" style={{
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.15)',
          }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold tracking-widest" style={{ color: '#ef4444' }}>
                NEEDS ATTENTION
              </span>
              <span className="text-xs" style={{ color: '#44445a' }}>
                — scores rose since last scan
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {rising.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-150"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f0f0ff',
                  }}
                  onClick={() => nav(`/vendor/${v.id}`)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.14)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                >
                  <span className="font-medium truncate max-w-[120px]">{v.name}</span>
                  <span className="font-bold shrink-0" style={{ color: '#ef4444' }}>
                    +{v.score_delta} ↑
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vendor grid */}
        {vendors.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <>
            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs" style={{ color: '#44445a' }}>Sort:</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                  style={{
                    background: sortBy === key ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                    border: sortBy === key ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    color: sortBy === key ? '#a78bfa' : '#44445a',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedVendors.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    opacity: cardsVisible ? 1 : 0,
                    transform: cardsVisible ? 'translateY(0)' : 'translateY(14px)',
                    transition: `opacity 260ms cubic-bezier(0.16,1,0.3,1) ${i * 18}ms, transform 260ms cubic-bezier(0.16,1,0.3,1) ${i * 18}ms`,
                  }}
                >
                  <VendorCard
                    vendor={v}
                    onDelete={handleDelete}
                    onScan={handleScan}
                    scanning={!!scanning[v.id]}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <AddVendorModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}

      <Footer />
    </div>
  )
}
