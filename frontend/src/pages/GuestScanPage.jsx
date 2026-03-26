import { useState } from 'react'
import { Link } from 'react-router-dom'
import { guestScan, downloadGuestReport } from '../api/client'

const riskColor = (s) => s >= 70 ? '#f97316' : s >= 35 ? '#eab308' : '#22c55e'
const riskLabel = (s) => s >= 70 ? 'HIGH RISK' : s >= 35 ? 'MEDIUM RISK' : 'LOW RISK'
const sevColor  = (s) => ({ CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }[s] || '#6b7280')

export default function GuestScanPage() {
  const [domain,      setDomain]      = useState('')
  const [name,        setName]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [downloading, setDownloading] = useState(false)

  const validate = () => {
    const d = domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    const n = name.trim()
    if (!d)           return 'Domain is required.'
    if (d.length > 253) return 'Domain must be under 253 characters.'
    if (!n)           return 'Vendor name is required.'
    if (n.length > 100) return 'Vendor name must be under 100 characters.'
    return null
  }

  const handleScan = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    const err = validate()
    if (err) { setError(err); return }

    const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase()
    const cleanName   = name.trim()

    setLoading(true)
    try {
      const res = await guestScan({ domain: cleanDomain, name: cleanName })
      setResult({ ...res.data, name: cleanName, domain: cleanDomain })
    } catch (e) {
      setError(e.response?.data?.detail || 'Scan failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!result) return
    setDownloading(true)
    try {
      const res = await downloadGuestReport({
        name:   result.name,
        domain: result.domain,
        score:  result.score,
        events: result.events,
      })
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href     = url
      link.download = `venderscope-guest-${result.domain}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF generation failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Back link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity hover:opacity-70"
          style={{ color: 'var(--mid)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to login
        </Link>

        {/* Heading */}
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--hi)' }}>
          Guest Scan
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--mid)' }}>
          Quick CVE lookup — no account required. Results are not saved.
        </p>

        {/* Scan form */}
        <form
          onSubmit={handleScan}
          className="rounded-xl p-6 space-y-4 mb-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <Field label="Vendor name" value={name} onChange={setName} placeholder="e.g. Stripe" />
          <Field label="Domain" value={domain} onChange={setDomain} placeholder="e.g. stripe.com" />

          {error && !result && (
            <p className="text-xs px-3 py-2 rounded-lg"
               style={{ color: '#ff4444', background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.12)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading
              ? <Spinner label={`Scanning ${domain || ''}…`} />
              : 'Scan (CVEs only)'}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div>
            {/* Limitation banner */}
            <div className="rounded-xl px-4 py-3 mb-5 text-sm"
                 style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
              <span className="font-semibold">&#9888; Partial scan.</span>{' '}
              Guest mode runs CVE checks only. Breach data, infrastructure exposure,
              compliance posture, and vendor profiling require an account.
              This score may be significantly lower than the actual vendor risk.
            </div>

            {/* Score */}
            <div className="rounded-xl p-6 mb-4 text-center"
                 style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div className="text-6xl font-bold tabular-nums mb-1"
                   style={{ color: riskColor(result.score) }}>
                {result.score}
              </div>
              <div className="text-xs font-bold tracking-widest"
                   style={{ color: riskColor(result.score), opacity: 0.7 }}>
                {riskLabel(result.score)}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--mid)' }}>
                Score based on CVEs only · Full scan requires an account
              </p>
            </div>

            {/* Events */}
            <div className="rounded-xl p-5 mb-4"
                 style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--hi)' }}>
                CVE Findings ({result.events.length})
              </h2>
              {result.events.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--mid)' }}>No CVEs found for this vendor.</p>
              ) : (
                <div className="space-y-2">
                  {result.events.map((evt, i) => (
                    <div key={i} className="rounded-lg p-3"
                         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--hi)' }}>
                          {evt.title}
                        </span>
                        <span className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded"
                              style={{ color: sevColor(evt.severity), background: `${sevColor(evt.severity)}18` }}>
                          {evt.severity}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--mid)' }}>
                        {evt.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Download + error */}
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg mb-3"
                 style={{ color: '#ff4444', background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.12)' }}>
                {error}
              </p>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity mb-5"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a78bfa',
                       border: '1px solid rgba(99,102,241,0.3)', opacity: downloading ? 0.6 : 1,
                       cursor: downloading ? 'not-allowed' : 'pointer' }}
            >
              {downloading ? <Spinner label="Generating PDF…" /> : 'Download PDF Report'}
            </button>

            {/* CTA */}
            <div className="rounded-xl p-5 text-center"
                 style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--hi)' }}>
                You&#39;re seeing a partial picture.
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--mid)' }}>
                Create a free account to run full scans including breach data, Shodan exposure,
                compliance posture, and vendor profiling — and track score changes over time.
              </p>
              <Link
                to="/register"
                className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Create free account &#x2192;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--mid)' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
        style={{
          background: 'var(--input)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--line)'}`,
          color: 'var(--hi)',
          boxShadow: focused ? '0 0 0 3px rgba(139,92,246,0.12)' : 'none',
        }}
      />
    </div>
  )
}

function Spinner({ label }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <path d="M7 2a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  )
}
