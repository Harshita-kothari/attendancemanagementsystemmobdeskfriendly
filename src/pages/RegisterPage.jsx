import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [department, setDepartment] = useState('B.Tech CSE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await register({ name, email, password, role, department })
      toast.success('Account registered successfully. Please sign in.')
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl shadow-sm p-8">
        <div className="mb-8 flex items-center gap-3">
          <button type="button" onClick={() => navigate('/login')} className="text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-surface-900 dark:text-white">Create your account</h2>
            <p className="text-sm text-surface-500 dark:text-surface-400">Register before signing in to FaceAttend.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" className="input" placeholder="Your name" required />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="input" placeholder="Create a password" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="input" required>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 dark:text-surface-400 block mb-1.5">Department</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} type="text" className="input" placeholder="Department" />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 h-11 mt-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Register Account'}
          </button>
        </form>

        <p className="text-sm text-surface-500 text-center mt-6">
          Already registered? <Link to="/login" className="text-brand-600 dark:text-brand-400 font-semibold">Sign in here</Link>
        </p>
      </div>
    </div>
  )
}
