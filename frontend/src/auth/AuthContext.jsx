/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout, refresh as apiRefresh } from '../api/client'
import { setAccessToken, clearAccessToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // { email } once decoded from token
  const [loading, setLoading] = useState(true)   // true during initial silent refresh

  // Decode the user email from a JWT without verifying (verification happens server-side)
  const _parseToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return { id: payload.sub }
    } catch {
      return null
    }
  }

  // Called on mount — attempts silent login via the httpOnly refresh cookie
  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await apiRefresh()
      setAccessToken(data.access_token)
      setUser(_parseToken(data.access_token))
    } catch {
      // No valid cookie — user needs to log in
      clearAccessToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    silentRefresh()
  }, [silentRefresh])

  const login = async (email, password) => {
    const { data } = await apiLogin({ email, password })
    setAccessToken(data.access_token)
    setUser(_parseToken(data.access_token))
    return data
  }

  const logoutUser = async () => {
    try {
      await apiLogout()
    } finally {
      clearAccessToken()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout: logoutUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
