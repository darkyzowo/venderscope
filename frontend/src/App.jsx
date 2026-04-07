import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Dashboard from './pages/Dashboard'
import VendorDetail from './pages/VendorDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import DocPage from './pages/DocPage'
import GuestScanPage from './pages/GuestScanPage'
import privacyMd from './docs/privacy.md?raw'
import termsMd from './docs/terms.md?raw'
import securityMd from './docs/security.md?raw'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        {/* Delayed fade-in prevents flash on fast auth checks */}
        <div className="animate-spinner-in flex flex-col items-center gap-4">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z"
              stroke="var(--line)" strokeWidth="1.5" fill="none"
            />
            <path
              d="M16 2.5L27.5 9.25V22.75L16 29.5L4.5 22.75V9.25L16 2.5Z"
              stroke="var(--accent)" strokeWidth="1.5" fill="none"
              strokeDasharray="88"
              strokeDashoffset="66"
              style={{ transformOrigin: '50% 50%', animation: 'spin 1.1s linear infinite' }}
            />
          </svg>
          <span style={{ fontSize: 11, color: 'var(--lo)', letterSpacing: '0.1em' }}>LOADING</span>
        </div>
        <style>{`@keyframes spin { to { stroke-dashoffset: -88; } }`}</style>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/guest"    element={<GuestScanPage />} />
          <Route path="/" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/vendor/:id" element={
            <ProtectedRoute><VendorDetail /></ProtectedRoute>
          } />
          {/* Public doc pages — no auth required */}
          <Route path="/privacy"  element={<DocPage title="Privacy Policy"  markdown={privacyMd} />} />
          <Route path="/terms"    element={<DocPage title="Terms of Service" markdown={termsMd} />} />
          <Route path="/security" element={<DocPage title="Security Policy" markdown={securityMd} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
