import { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('fa_user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('fa_token')
    if (!token) {
      setInitializing(false)
      return
    }

    let cancelled = false
    async function hydrateUser() {
      try {
        const { data } = await api.get('/api/auth/me')
        if (!cancelled) {
          setUser(data.user)
        }
      } catch {
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    hydrateUser()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user) {
      localStorage.setItem('fa_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('fa_user')
      localStorage.removeItem('fa_token')
    }
  }, [user])

  async function login(payload) {
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', payload)
      if (data.otpRequired) {
        return data
      }
      localStorage.setItem('fa_token', data.token)
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  async function signup(payload) {
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/signup', payload)
      localStorage.setItem('fa_token', data.token)
      setUser(data.user)
      return data
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, initializing, setUser, login, signup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
