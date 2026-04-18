import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, User, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import VSLogo from './VSLogo'
import { useAuth } from '../auth/AuthContext'

export default function TopNav() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        height: '52px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 20px',
        }}
      >
        {/* Logo + wordmark */}
        <Link
          to="/"
          aria-label="VenderScope — go to dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <VSLogo height={24} />
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--mid)',
            letterSpacing: '0.01em',
            userSelect: 'none',
          }}>
            VenderScope
          </span>
        </Link>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bell — stub */}
        <button
          aria-label="Notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--lo)',
            borderRadius: '8px',
            flexShrink: 0,
            transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface)'
            e.currentTarget.style.color = 'var(--mid)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = 'var(--lo)'
          }}
        >
          <Bell size={16} />
        </button>

        {/* User menu */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: userMenuOpen ? 'var(--surface)' : 'var(--elevated)',
              border: '1px solid var(--line)',
              borderRadius: '9999px',
              cursor: 'pointer',
              color: 'var(--mid)',
              transition: 'background 150ms, border-color 150ms',
            }}
            onMouseEnter={(e) => {
              if (!userMenuOpen) e.currentTarget.style.borderColor = 'var(--border)'
            }}
            onMouseLeave={(e) => {
              if (!userMenuOpen) e.currentTarget.style.borderColor = 'var(--line)'
            }}
          >
            <User size={15} />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                role="menu"
                aria-label="User options"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: '160px',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '4px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    color: 'var(--mid)',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'background 120ms, color 120ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(240,68,56,0.08)'
                    e.currentTarget.style.color = 'var(--risk-high)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                    e.currentTarget.style.color = 'var(--mid)'
                  }}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  )
}
