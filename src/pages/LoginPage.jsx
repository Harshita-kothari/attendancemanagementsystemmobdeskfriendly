import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Scan, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

const DEMO_USERS = [
  { label: 'Admin',   email: 'admin@mit.edu',   color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  { label: 'Teacher', email: 'teacher@mit.edu',  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  { label: 'Student', email: 'student@mit.edu',  color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('admin@mit.edu')
  const [password, setPassword] = useState('password123')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 relative bg-brand-600 overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/5"
              style={{ width: `${120+i*60}px`, height: `${120+i*60}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative text-center text-white">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Scan size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-semibold mb-3">FaceAttend</h1>
          <p className="text-blue-200 text-lg mb-10">AI-Powered Attendance System</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[['98%', 'Accuracy'], ['0.3s', 'Recognition'], ['Anti', 'Spoofing']].map(([val, label]) => (
              <div key={label} className="bg-white/10 rounded-2xl p-4">
                <p className="text-2xl font-semibold">{val}</p>
                <p className="text-blue-200 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center mb-6 lg:hidden">
              <Scan size={20} className="text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-surface-900 dark:text-white">Welcome back</h2>
            <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">Sign in to your account</p>
          </div>

          {/* Demo quick select */}
          <div className="flex gap-2 mb-6">
            {DEMO_USERS.map(u => (
              <button key={u.label} onClick={() => setEmail(u.email)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${u.color} ${email === u.email ? 'ring-2 ring-brand-500' : ''}`}>
                {u.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Email</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="password123" required />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 h-11 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-sm text-surface-500 text-center mt-4">
            Don’t have an account yet? <Link to="/register" className="text-brand-600 dark:text-brand-400 font-semibold">Create one now</Link>
          </p>

          <p className="text-xs text-surface-400 text-center mt-6">
            Demo password: <span className="font-mono text-surface-600 dark:text-surface-300">password123</span>
          </p>
        </div>
      </div>
    </div>
  )
}
