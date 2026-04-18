import { useState } from 'react'
import { Link } from 'react-router-dom'
import DeleteAccountModal from './DeleteAccountModal'
import VSLogo from './VSLogo'
import { CONSENT_SETTINGS_EVENT } from '../consent/siteConsent'

const FooterLink = ({ to, children, external }) =>
  external ? (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className="transition-colors duration-150"
      style={{ color: '#8080aa' }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
      onMouseLeave={(e) => e.currentTarget.style.color = '#8080aa'}
    >{children}</a>
  ) : (
    <Link
      to={to}
      className="transition-colors duration-150"
      style={{ color: '#8080aa' }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
      onMouseLeave={(e) => e.currentTarget.style.color = '#8080aa'}
    >{children}</Link>
  )

export default function Footer() {
  const [showDelete, setShowDelete] = useState(false)
  const openCookieSettings = () => {
    window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT))
  }

  return (
    <>
      <footer style={{ borderTop: '1px solid #0f0f1e' }} className="w-full">
        <div className="max-w-7xl mx-auto page-safe-x px-4 sm:px-6 py-6 sm:py-8">

          {/* Main row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
            {/* Brand */}
            <div className="flex justify-center sm:justify-start">
              <VSLogo height={22} />
            </div>

            {/* Navigation links */}
            <nav className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-5 text-xs">
              <FooterLink to="/privacy">Privacy Policy</FooterLink>
              <FooterLink to="/terms">Terms of Service</FooterLink>
              <FooterLink to="/security">Security</FooterLink>
              <button
                onClick={openCookieSettings}
                className="transition-colors duration-150"
                style={{ background: 'none', border: 'none', padding: 0, color: '#8080aa', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#8080aa'}
              >
                Cookie Settings
              </button>
            </nav>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mt-4 text-center sm:text-left">
            <p className="text-xs leading-relaxed" style={{ color: '#8080aa' }}>
              © {new Date().getFullYear()} VenderScope · Continuous Passive Vendor Risk Intelligence · MIT Licence
            </p>

            <button
              onClick={() => setShowDelete(true)}
              className="text-xs transition-colors duration-150"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#8080aa' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#8080aa'}
            >
              Delete Account
            </button>
          </div>
        </div>
      </footer>

      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </>
  )
}
