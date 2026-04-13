import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatedPage } from './components/AnimatedPage'
import { AppLoader } from './components/AppLoader'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { AdminDashboard } from './pages/AdminDashboard'
import { StudentDashboard } from './pages/StudentDashboard'
import { TeacherDashboard } from './pages/TeacherDashboard'

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student'} replace />
}

export default function App() {
  const location = useLocation()
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowLoader(false), 1650)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <AnimatePresence mode="wait">
        {showLoader ? (
          <AppLoader key="app-loader" />
        ) : (
          <AnimatedPage key={location.pathname} routeKey={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/teacher/*" element={<ProtectedRoute roles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/student/*" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
            </Routes>
          </AnimatedPage>
        )}
      </AnimatePresence>
      <Toaster position="top-right" />
    </>
  )
}
