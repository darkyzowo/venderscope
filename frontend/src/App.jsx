import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Dashboard from './pages/Dashboard'
import VendorDetail from './pages/VendorDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import DocPage from './pages/DocPage'
import privacyMd from './docs/privacy.md?raw'
import termsMd from './docs/terms.md?raw'
import securityMd from './docs/security.md?raw'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="var(--line)" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
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
