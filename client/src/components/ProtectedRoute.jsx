import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ roles, children }) {
  const { user, initializing } = useAuth()
  if (initializing) return null
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student'} replace />
  return children
}
