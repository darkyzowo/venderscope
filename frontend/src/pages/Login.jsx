import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

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
    requestAnimationFrame(() => setVisible(true))
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div
        style={{
          width: '100%', maxWidth: 400,
          transition: 'opacity 400ms cubic-bezier(0.16,1,0.3,1), transform 400ms cubic-bezier(0.16,1,0.3,1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
        }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <HexLogo />
          <span className="text-xl font-semibold tracking-tight" style={{ color: 'var(--hi)' }}>
            VenderScope
          </span>
          <p className="text-sm" style={{ color: 'var(--mid)' }}>Sign in to your workspace</p>
        </div>

        {/* Account deleted notice */}
        {accountDeleted && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
               style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
            Your account has been permanently deleted.
          </div>
        )}

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-6 space-y-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <AuthField label="Email" type="email" value={email} onChange={setEmail}
            placeholder="you@company.com" autoComplete="email" inputRef={emailRef} />

          <AuthField label="Password" type="password" value={password} onChange={setPassword}
            placeholder="••••••••" autoComplete="current-password" />

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{
              color: '#ff4444', background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.12)',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <SpinnerRow label="Signing in…" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--mid)' }}>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-l)' }}>
            Create one
          </Link>
        </p>
        <p className="text-center text-sm mt-2" style={{ color: 'var(--mid)' }}>
          Just browsing?{' '}
          <Link to="/guest" className="font-medium hover:opacity-80 transition-opacity" style={{ color: 'var(--mid)' }}>
            Try as Guest →
          </Link>
        </p>
      </div>
    </div>
  )
}

function AuthField({ label, type, value, onChange, placeholder, autoComplete, inputRef }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--mid)' }}>{label}</label>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
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

function SpinnerRow({ label }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  )
}

function HexLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
      <path d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z" stroke="#8b5cf6" strokeWidth="1.5" fill="rgba(139,92,246,0.08)" />
      <circle cx="16" cy="16" r="5.5" stroke="#8b5cf6" strokeWidth="1.2" fill="rgba(139,92,246,0.12)" />
      <circle cx="16" cy="16" r="1.8" fill="#8b5cf6" />
      <line x1="16" y1="10.5" x2="16" y2="12.2" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
      <line x1="16" y1="19.8" x2="16" y2="21.5" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
      <line x1="10.5" y1="16" x2="12.2" y2="16" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
      <line x1="19.8" y1="16" x2="21.5" y2="16" stroke="#8b5cf6" strokeWidth="1.2" strokeOpacity="0.6" />
    </svg>
  )
}
