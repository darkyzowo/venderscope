import { useState } from 'react'
import { Link } from 'react-router-dom'
import DeleteAccountModal from './DeleteAccountModal'

const FooterLink = ({ to, children, external }) =>
  external ? (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className="transition-colors duration-150"
      style={{ color: '#6b7280' }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
      onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
    >{children}</a>
  ) : (
    <Link
      to={to}
      className="transition-colors duration-150"
      style={{ color: '#6b7280' }}
      onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
      onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
    >{children}</Link>
  )

export default function Footer() {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <>
      <footer style={{ borderTop: '1px solid #0f0f1e' }} className="mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Main row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Brand */}
            <span className="text-sm font-semibold" style={{ color: '#8b5cf6' }}>
              Vender<span style={{ color: '#94a3b8' }}>Scope</span>
            </span>

            {/* Navigation links */}
            <nav className="flex flex-wrap items-center gap-5 text-xs">
              <FooterLink to="/privacy">Privacy Policy</FooterLink>
              <FooterLink to="/terms">Terms of Service</FooterLink>
              <FooterLink to="/security">Security</FooterLink>
            </nav>
          </div>

          {/* Bottom row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <p className="text-xs" style={{ color: '#4b5563' }}>
              © {new Date().getFullYear()} VenderScope · Continuous Passive Vendor Risk Intelligence · MIT Licence
            </p>

            <button
              onClick={() => setShowDelete(true)}
              className="text-xs transition-colors duration-150"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#4b5563' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#4b5563'}
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
