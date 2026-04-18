import { useEffect, useMemo, useState } from 'react'
import {
  CONSENT_ACCEPTED,
  CONSENT_DECLINED,
  CONSENT_SETTINGS_EVENT,
  canUseOptionalStorage,
  clearOptionalClientStorage,
  readSiteConsent,
  writeSiteConsent,
} from '../consent/siteConsent'

export default function SiteConsentBanner() {
  const [consent, setConsent] = useState(() => readSiteConsent())
  const [bannerOpen, setBannerOpen] = useState(() => readSiteConsent() == null)

  useEffect(() => {
    const onOpen = () => setBannerOpen(true)
    window.addEventListener(CONSENT_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(CONSENT_SETTINGS_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!canUseOptionalStorage(consent)) {
      clearOptionalClientStorage()
    }
  }, [consent])

  const hasConsented = consent != null
  const optionalCookiesEnabled = useMemo(() => canUseOptionalStorage(consent), [consent])

  const decideConsent = (nextConsent) => {
    writeSiteConsent(nextConsent)
    setConsent(nextConsent)
    if (nextConsent === CONSENT_DECLINED) {
      clearOptionalClientStorage()
    }
    setBannerOpen(false)
  }

  if (!bannerOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 page-safe-x page-safe-y"
      style={{
        background: 'rgba(4,4,10,0.68)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-4 sm:p-5"
        style={{
          background: 'linear-gradient(160deg, rgba(15,15,30,0.98) 0%, rgba(10,10,21,0.98) 100%)',
          border: '1px solid rgba(139,92,246,0.14)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5"
              style={{ color: '#a78bfa' }}
            >
              Privacy Settings
            </p>
            <h2 className="text-base font-semibold" style={{ color: 'var(--hi)' }}>
              Cookie preferences
            </h2>
          </div>
          {hasConsented && (
            <button
              onClick={() => setBannerOpen(false)}
              className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] transition-colors duration-150"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'var(--lo)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = 'var(--mid)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = 'var(--lo)'
              }}
            >
              Close
            </button>
          )}
        </div>

        <div
          className="rounded-xl p-3.5 mb-4"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: 'var(--hi)' }}>
            VenderScope uses one strictly necessary authentication cookie for secure sign-in and silent session refresh.
          </p>
          <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--lo)' }}>
            Optional cookies are reserved for future non-essential features. We do not use advertising or analytics cookies.
          </p>
        </div>

        <div className="space-y-2.5 mb-4">
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.14)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: '#e8fff1' }}>
                  Strictly necessary cookies
                </p>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#8fb89f' }}>
                  Required for authentication and secure session continuity.
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: '#4ade80',
                }}
              >
                Always on
              </span>
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--hi)' }}>
                  Optional cookies
                </p>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--lo)' }}>
                  For future non-essential features only.
                </p>
              </div>
              {hasConsented && (
                <span
                  className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{
                    background: optionalCookiesEnabled ? 'rgba(139,92,246,0.12)' : 'rgba(251,191,36,0.12)',
                    border: optionalCookiesEnabled ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(251,191,36,0.2)',
                    color: optionalCookiesEnabled ? '#c4b5fd' : '#fbbf24',
                  }}
                >
                  {optionalCookiesEnabled ? 'Allowed' : 'Blocked'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={() => decideConsent(CONSENT_DECLINED)}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--mid)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = 'var(--hi)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'var(--mid)'
            }}
          >
            Decline Optional
          </button>
          <button
            onClick={() => decideConsent(CONSENT_ACCEPTED)}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150"
            style={{
              background: '#8b5cf6',
              color: '#fff',
              boxShadow: '0 10px 24px rgba(139,92,246,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#7c3aed'
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(139,92,246,0.28)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#8b5cf6'
              e.currentTarget.style.boxShadow = '0 10px 24px rgba(139,92,246,0.2)'
            }}
          >
            Accept Optional
          </button>
        </div>

        {!hasConsented && (
          <p className="text-[11px] text-center mt-3" style={{ color: 'var(--lo)' }}>
            Please choose whether optional cookies can be used.
          </p>
        )}
      </div>
    </div>
  )
}
