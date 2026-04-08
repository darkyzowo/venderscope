import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import VSLogo from '../components/VSLogo'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountDeleted = searchParams.get('deleted') === '1'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [visible, setVisible]   = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    // Double rAF ensures paint has happened before we trigger transitions
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    emailRef.current?.focus()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Stagger helper — returns transition styles keyed to `visible` state
  const reveal = (delayMs) => ({
    opacity:    visible ? 1 : 0,
    transform:  visible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms,
                 transform 600ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms`,
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#090911',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Background layers ────────────────────────────────── */}
      <div className="auth-grid"  aria-hidden="true" />
      <div className="auth-scan"  aria-hidden="true" />
      <div className="auth-orb auth-orb-a" aria-hidden="true" />
      <div className="auth-orb auth-orb-b" aria-hidden="true" />
      <div className="auth-orb auth-orb-c" aria-hidden="true" />

      {/* ── Content ──────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Logo — draws in on first paint */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28, ...reveal(0) }}>
          <VSLogo height={68} animated />
        </div>

        {/* Tagline */}
        <p style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#8080aa',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 32,
          ...reveal(220),
        }}>
          Continuous vendor risk intelligence
        </p>

        {/* Account-deleted notice */}
        {accountDeleted && (
          <div style={{ marginBottom: 16, ...reveal(260) }}>
            <div style={{
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 12,
              padding: '11px 16px',
              fontSize: 13,
              color: '#4ade80',
              textAlign: 'center',
            }}>
              Your account has been permanently deleted.
            </div>
          </div>
        )}

        {/* Glass card */}
        <div style={{
          background: 'rgba(9,9,17,0.78)',
          border: '1px solid rgba(139,92,246,0.18)',
          borderRadius: 20,
          padding: '32px 32px 28px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: [
            '0 0 0 1px rgba(139,92,246,0.06)',
            '0 24px 64px rgba(0,0,0,0.55)',
            'inset 0 1px 0 rgba(255,255,255,0.05)',
          ].join(', '),
          ...reveal(360),
        }}>

          {/* Section label */}
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#44445a',
            marginBottom: 20,
          }}>
            Sign in to your workspace
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={reveal(460)}>
              <LoginField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                autoComplete="email"
                inputRef={emailRef}
              />
            </div>

            <div style={reveal(540)}>
              <LoginField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: 'rgba(255,68,68,0.06)',
                border: '1px solid rgba(255,68,68,0.18)',
                borderRadius: 10,
                padding: '10px 13px',
                fontSize: 13,
                color: '#ff6b6b',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <div style={{ marginTop: 6, ...reveal(620) }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  transition: 'all 200ms ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #9b6cf6 0%, #8b4ced 100%)'
                    e.currentTarget.style.boxShadow = '0 0 28px rgba(139,92,246,0.38), 0 8px 24px rgba(0,0,0,0.35)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(0) scale(0.98)' }}
                onMouseUp={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px) scale(1)' }}
              >
                {loading ? <SpinnerRow label="Signing in…" /> : 'Sign in'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer links */}
        <div style={{ marginTop: 24, textAlign: 'center', ...reveal(720) }}>
          <p style={{ fontSize: 13, color: '#8080aa', marginBottom: 8 }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{ color: '#a78bfa', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Create one
            </Link>
          </p>
          <p style={{ fontSize: 13, color: '#8080aa' }}>
            Just browsing?{' '}
            <Link
              to="/guest"
              style={{ color: '#8080aa', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#b8b8d0')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8080aa')}
            >
              Try as Guest →
            </Link>
          </p>
        </div>

        {/* Micro brand footer */}
        <p style={{
          marginTop: 36,
          textAlign: 'center',
          fontSize: 10,
          color: '#2a2a4a',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          ...reveal(820),
        }}>
          VenderScope · Vendor Risk Intelligence
        </p>
      </div>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function LoginField({ label, type, value, onChange, placeholder, autoComplete, inputRef }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: focused ? '#a78bfa' : '#8080aa',
        marginBottom: 7,
        transition: 'color 180ms ease',
      }}>
        {label}
      </label>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '11px 14px',
          borderRadius: 10,
          border: focused
            ? '1px solid rgba(139,92,246,0.55)'
            : '1px solid rgba(255,255,255,0.07)',
          background: focused
            ? 'rgba(139,92,246,0.06)'
            : 'rgba(255,255,255,0.03)',
          color: '#f0f0ff',
          fontSize: 14,
          outline: 'none',
          transition: 'all 180ms ease',
          boxShadow: focused
            ? '0 0 0 3px rgba(139,92,246,0.12), inset 0 1px 2px rgba(0,0,0,0.15)'
            : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function SpinnerRow({ label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  )
}
