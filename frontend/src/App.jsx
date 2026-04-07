import { useRef, useLayoutEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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

/**
 * PageTransition — coordinates fade between route changes.
 *
 * Uses useLayoutEffect (fires before paint) to guarantee the new page
 * starts at opacity 0 before the browser has a chance to render it,
 * eliminating the flash-of-content on navigation.
 *
 * Sequence on each navigation:
 *   1. useLayoutEffect fires synchronously → setShow(false)
 *   2. React re-renders the new route at opacity:0 — no flash
 *   3. Double rAF ensures browser paints the invisible state first
 *   4. setShow(true) → CSS transition plays (220ms spring)
 */
function PageTransition({ children }) {
  const location  = useLocation()
  const frameRef  = useRef(null)
  const [show, setShow] = useState(false)

  useLayoutEffect(() => {
    setShow(false)
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => setShow(true))
    })
    return () => cancelAnimationFrame(frameRef.current)
  }, [location.pathname])

  return (
    <div
      style={{
        opacity:    show ? 1 : 0,
        transform:  show ? 'none' : 'translateY(10px)',
        transition: show
          ? 'opacity 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)'
          : 'none',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}

/** Auth check spinner — fades in only if loading takes >150ms */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="animate-spinner-in">
        <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="var(--line)" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

/** Router must be inside BrowserRouter to use useLocation */
function AppRouter() {
  return (
    <PageTransition>
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
        <Route path="/privacy"  element={<DocPage title="Privacy Policy"  markdown={privacyMd} />} />
        <Route path="/terms"    element={<DocPage title="Terms of Service" markdown={termsMd} />} />
        <Route path="/security" element={<DocPage title="Security Policy" markdown={securityMd} />} />
      </Routes>
    </PageTransition>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  )
}
