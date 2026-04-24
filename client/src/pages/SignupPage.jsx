import { motion } from 'framer-motion'
import { GraduationCap, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { FaceCapture } from '../components/FaceCapture'
import { useAuth } from '../context/AuthContext'
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneInput } from '../lib/validation'

export function SignupPage() {
  const { signup, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    department: 'General',
    preferredLanguage: 'en',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
  })
  const [faceImages, setFaceImages] = useState([])
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const role = searchParams.get('role')
    if (role === 'student') {
      setForm((current) => ({ ...current, role: 'student' }))
    }
  }, [searchParams])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')
    if (!isValidPhoneNumber(form.parentPhone)) {
      const message = getPhoneValidationMessage('Parent phone')
      setSubmitError(message)
      toast.error(message)
      return
    }

    if (faceImages.length > 0 && faceImages.length < 5) {
      const message = 'Capture at least 5 clear face samples or remove them and finish face setup later from the profile page.'
      setSubmitError(message)
      toast.error(message)
      return
    }

    try {
      const result = await signup({ ...form, faceImages })
      const faceRegistered = Boolean(result.user?.faceRegistered)
      toast.success(
        faceRegistered
          ? 'Account created successfully with face registration.'
          : 'Account created successfully. Complete face setup from your profile.',
      )
      if (result.warningMessage) {
        setSubmitError(result.warningMessage)
        toast.error(result.warningMessage)
      }
      navigate(result.user.role === 'teacher' ? '/teacher' : faceRegistered ? '/student' : '/student/profile')
    } catch (error) {
      const message = error.response?.data?.message || error.friendlyMessage || 'Signup failed'
      const detail = error.response?.data?.detail
      const ownerEmail = error.response?.data?.ownerEmail
      const fullMessage = ownerEmail
        ? `${message} Existing owner: ${ownerEmail}`
        : detail && detail !== message
          ? `${message} ${detail}`
          : message
      setSubmitError(fullMessage)
      if (ownerEmail) {
        toast.error(`${message} Existing owner: ${ownerEmail}`)
      } else {
        toast.error(fullMessage)
      }
    }
  }

  return (
    <div className="min-h-screen bg-auth px-4 py-8 text-slate-900 dark:text-white">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-panel p-4 sm:p-6 lg:p-8">
            <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20 lg:hidden">
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">Student-ready onboarding</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight">Attendance Management System</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Create a secure student account with face registration, parent alerts, and smooth access on both desktop and mobile.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Face dataset', 'Parent alerts', 'Student dashboard'].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Create account</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Professional onboarding</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
              Create a secure student account with face registration, parent alerts, and attendance access across desktop and mobile.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setSearchParams({ role: 'student' })
                  setForm((current) => ({ ...current, role: 'student' }))
                }}
                className="rounded-[1.5rem] border border-blue-500 bg-blue-50 p-4 text-left transition dark:bg-blue-950/40"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap size={18} />
                  <span className="font-medium">Student Signup</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Use face samples now to lock the account, or skip and finish face setup later.</p>
              </button>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-950">
                <p className="font-medium">Teacher accounts are admin-only</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Teacher and admin accounts cannot be created through self-signup. They must be created from the admin panel.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                [ShieldCheck, 'Face-safe signup', 'If you capture face samples here, duplicate face accounts are blocked during signup itself.'],
                [Sparkles, 'Parent alerts', 'Parent contact can receive attendance updates.'],
                [GraduationCap, 'Student-ready', 'Students go straight to the dashboard when face setup is already completed.'],
              ].map(([Icon, title, text]) => (
                <div key={title} className="rounded-[1.25rem] border border-slate-200/80 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <Icon size={18} className="text-blue-500" />
                  <p className="mt-3 text-sm font-semibold">{title}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white/60 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/40 sm:rounded-[1.75rem] sm:p-5">
              {submitError ? (
                <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {submitError}
                </div>
              ) : null}
              <input className="field" placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <input className="field" placeholder="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              <input className="field" placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <input className="field" value="Student" readOnly />
                <select className="field" value={form.preferredLanguage} onChange={(event) => setForm({ ...form, preferredLanguage: event.target.value })}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
              <input className="field" placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <input className="field" placeholder="Parent name" value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} />
                <input className="field" placeholder="Parent phone" inputMode="tel" value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: normalizePhoneInput(event.target.value) })} />
                <input className="field sm:col-span-2" placeholder="Parent email" type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} />
              </div>
              <button className="action-primary w-full justify-center" disabled={loading}>
                {loading ? 'Creating account...' : 'Create student account'}
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              Already have an account? <Link to="/login?role=student" className="font-medium text-blue-600">Login as student</Link>
            </p>
          </div>

          <div className="space-y-6">
            <FaceCapture onFramesChange={setFaceImages} maxFrames={6} label="Student face registration (optional during signup)" />
            <div className="card-panel p-5">
              <p className="text-sm font-semibold">Why is face setup optional here?</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                If you capture 5 or more samples here, signup will try to register the face immediately and block duplicate accounts. You can still skip it and complete face registration from the profile page.
              </p>
              <div className="mt-4 rounded-[1.25rem] border border-slate-200/80 bg-white/60 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                If face registration succeeds during signup, you will not be asked to capture it again from the profile page.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
