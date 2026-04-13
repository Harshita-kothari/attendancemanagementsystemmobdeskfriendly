import { createContext, useContext, useState, useEffect } from 'react'
import { MOCK_USERS } from '../data/mockData'

const AuthContext = createContext(null)

const loadUsers = () => {
  const stored = localStorage.getItem('fa_users')
  if (stored) {
    return JSON.parse(stored).map(user => ({
      ...user,
      password: user.password || 'password123',
      registered: typeof user.registered === 'boolean' ? user.registered : false,
    }))
  }
  return MOCK_USERS.map(user => ({
    ...user,
    password: 'password123',
    registered: false,
  }))
}

const saveUsers = (users) => {
  localStorage.setItem('fa_users', JSON.stringify(users))
}

const createAvatar = (name) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState(loadUsers)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('fa_user')
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    await new Promise(r => setTimeout(r, 800))
    const found = users.find(u => u.email === email)
    if (!found) {
      throw new Error('Account not found. Please register first.')
    }
    if (!found.registered) {
      throw new Error('Account not yet registered. Please complete registration.')
    }
    if (password !== found.password) {
      throw new Error('Invalid credentials')
    }
    const token = btoa(JSON.stringify({ id: found.id, exp: Date.now() + 86400000 }))
    const userData = { ...found, token }
    setUser(userData)
    localStorage.setItem('fa_user', JSON.stringify(userData))
    return userData
  }

  const register = async ({ name, email, password, role, department }) => {
    await new Promise(r => setTimeout(r, 800))
    if (!name || !email || !password || !role) {
      throw new Error('Please fill in all required fields.')
    }
    const existing = users.find(u => u.email === email)
    if (existing) {
      if (existing.registered) {
        throw new Error('An account with this email already exists.')
      }
      const updatedUser = {
        ...existing,
        name,
        password,
        role,
        department: department || existing.department || 'General',
        registered: true,
      }
      const nextUsers = users.map(u => u.email === email ? updatedUser : u)
      setUsers(nextUsers)
      saveUsers(nextUsers)
      return updatedUser
    }
    const newUser = {
      id: `u${Date.now()}`,
      name,
      email,
      role,
      department: department || 'General',
      avatar: createAvatar(name),
      password,
      registered: true,
    }
    const nextUsers = [...users, newUser]
    setUsers(nextUsers)
    saveUsers(nextUsers)
    return newUser
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('fa_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
