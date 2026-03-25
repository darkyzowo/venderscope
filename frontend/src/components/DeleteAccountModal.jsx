import { useState } from 'react'
import { deleteAccount } from '../api/client'
import { clearAccessToken } from '../api/client'

export default function DeleteAccountModal({ onClose }) {
  const [step, setStep] = useState(1)       // 1 = warning, 2 = confirm
  const [input, setInput] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const confirmed = input === 'DELETE'

  const handleClose = () => {
    setInput('')
    setPassword('')
    setError('')
    onClose()
  }

  const handleDelete = async () => {
    if (!confirmed) return
    setLoading(true)
    setError('')
    try {
      await deleteAccount({ password })
      clearAccessToken()
      window.location.href = '/login?deleted=1'
    } catch (e) {
      if (e.response?.status === 401) {
        setError('Incorrect password')
      } else {
        setError(e.response?.data?.detail || 'Something went wrong. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#0f1117', border: '1px solid #2a2a4a', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}
      >
        {step === 1 ? (
          <>
            {/* Step 1 — Warning */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="flex items-center justify-center rounded-xl w-10 h-10 shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="9" x2="12" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: '#f0f0ff' }}>Delete Account</h2>
                <p className="text-xs mt-0.5" style={{ color: '#44445a' }}>This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div
              className="rounded-xl p-4 mb-5 text-sm"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5' }}
            >
              <p className="font-semibold mb-2">Everything will be permanently deleted:</p>
              <ul className="space-y-1 text-xs" style={{ color: '#f87171' }}>
                <li>· Your account and login credentials</li>
                <li>· All vendors you have added</li>
                <li>· All risk events, scores, and scan history</li>
                <li>· All compliance data associated with your vendors</li>
              </ul>
            </div>

            <p className="text-sm mb-5" style={{ color: '#6b7280' }}>
              Your account and all associated data will be permanently and immediately deleted, in accordance with our{' '}
              <a href="/privacy" target="_blank" style={{ color: '#8b5cf6', textDecoration: 'underline' }}>Privacy Policy</a>.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#8888aa',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#dc2626', color: '#fff' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
              >
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — Type DELETE */}
            <div className="mb-5">
              <h2 className="font-bold text-base mb-1" style={{ color: '#f0f0ff' }}>Confirm Deletion</h2>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Type <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>DELETE</span> in
                the field below to permanently delete your account.
              </p>
            </div>

            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              placeholder="Type DELETE to confirm"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm mb-3 outline-none transition-all"
              style={{
                background: '#141425',
                border: `1px solid ${confirmed ? 'rgba(239,68,68,0.5)' : '#2a2a4a'}`,
                color: confirmed ? '#ef4444' : '#e2e8f0',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            />

            <label className="block text-xs mb-1" style={{ color: '#44445a' }}>
              Enter your password to confirm
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Your account password"
              className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none transition-all"
              style={{
                background: '#141425',
                border: '1px solid #2a2a4a',
                color: '#e2e8f0',
              }}
            />

            {error && (
              <p className="text-xs mb-3" style={{ color: '#f87171' }}>{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setInput(''); setPassword(''); setError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#8888aa',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30"
                style={{ background: '#dc2626', color: '#fff' }}
                onMouseEnter={(e) => { if (confirmed && !loading) e.currentTarget.style.background = '#b91c1c' }}
                onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                    </svg>
                    Deleting…
                  </span>
                ) : 'Delete My Account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
