import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register as apiRegister } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import VSLogo from '../components/VSLogo'

export default function Register() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [visible, setVisible]   = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    emailRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return }
    if (!/[A-Z]/.test(password)) { setError('Password must contain at least one uppercase letter.'); return }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number.'); return }

    setLoading(true)
    try {
      await apiRegister({ email, password })
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const reveal = (delayMs) => ({
    opacity:    visible ? 1 : 0,
    transform:  visible ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms,
                 transform 600ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms`,
  })

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 24px',
        background: '#090911',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Background layers (variant positions for Register) ── */}
      <div className="auth-grid" aria-hidden="true" />
      <svg className="auth-traces" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path className="auth-trace auth-trace-1" d="M-80,260 C200,180 550,360 900,280 S1280,240 1540,300" stroke="rgba(139,92,246,0.13)" strokeWidth="1.5" fill="none" pathLength="1" />
        <path className="auth-trace auth-trace-2" d="M-80,680 C160,620 420,730 720,650 S1080,640 1540,700" stroke="rgba(99,102,241,0.10)" strokeWidth="1"   fill="none" pathLength="1" />
        <path className="auth-trace auth-trace-3" d="M1180,-30 C1140,180 1220,380 1160,580 S1180,740 1150,940" stroke="rgba(139,92,246,0.09)" strokeWidth="1.2" fill="none" pathLength="1" />
        <path className="auth-trace auth-trace-4" d="M-60,440 C280,370 580,490 880,410 S1250,400 1540,370" stroke="rgba(109,87,200,0.11)" strokeWidth="1"   fill="none" pathLength="1" />
      </svg>
      <div className="auth-pulse-ring auth-pulse-ring-1" aria-hidden="true" />
      <div className="auth-pulse-ring auth-pulse-ring-2" aria-hidden="true" />
      <div className="auth-pulse-ring auth-pulse-ring-3" aria-hidden="true" />
      <div className="auth-orb auth-orb-a-reg" aria-hidden="true" />
      <div className="auth-orb auth-orb-b-reg" aria-hidden="true" />
      <div className="auth-orb auth-orb-c-reg" aria-hidden="true" />

      {/* ── Content ──────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 3 }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, ...reveal(0) }}>
          <VSLogo height={54} animated />
        </div>

        {/* Tagline */}
        <p style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#8080aa',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 16,
          ...reveal(220),
        }}>
          Start your risk intelligence workspace
        </p>

        {/* Glass card */}
        <div style={{
          background: 'rgba(9,9,17,0.78)',
          border: '1px solid rgba(139,92,246,0.18)',
          borderRadius: 20,
          padding: '24px 28px 20px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: [
            '0 0 0 1px rgba(139,92,246,0.06)',
            '0 24px 64px rgba(0,0,0,0.55)',
            'inset 0 1px 0 rgba(255,255,255,0.05)',
          ].join(', '),
          ...reveal(340),
        }}>

          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#44445a',
            marginBottom: 20,
          }}>
            Create your account
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={reveal(430)}>
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

            <div style={reveal(510)}>
              <LoginField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Min. 12 chars, 1 uppercase, 1 number"
                autoComplete="new-password"
              />
            </div>

            <div style={reveal(590)}>
              <LoginField
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {/* Requirements hint */}
            <p style={{
              fontSize: 11,
              color: '#44445a',
              lineHeight: 1.5,
              paddingLeft: 2,
              ...reveal(640),
            }}>
              12+ characters · uppercase letter · number
            </p>

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

            <div style={{ marginTop: 6, ...reveal(700) }}>
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
                {loading ? <SpinnerRow label="Creating account…" /> : 'Create account'}
              </button>
            </div>

          </form>
        </div>

        {/* Footer link */}
        <div style={{ marginTop: 12, textAlign: 'center', ...reveal(800) }}>
          <p style={{ fontSize: 13, color: '#8080aa' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: '#a78bfa', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Sign in
            </Link>
          </p>
        </div>

        <p style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 10,
          color: '#8080aa',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          ...reveal(880),
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
