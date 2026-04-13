import { motion } from 'framer-motion'
import { Camera, Eye, EyeOff, GraduationCap, ShieldCheck, Sparkles, Square, UserRoundCog } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRole = ['teacher', 'admin'].includes(searchParams.get('role')) ? searchParams.get('role') : 'student'
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', parentEmail: '', parentName: '', parentPhone: '' })
  const [otpChallengeId, setOtpChallengeId] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [faceRequired, setFaceRequired] = useState(false)
  const [capturedFace, setCapturedFace] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      toast.error('Allow camera access to complete face login verification.')
    }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  function captureFace() {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      toast.error('Wait for the camera to become ready, then capture your face.')
      return
    }
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    setCapturedFace(canvas.toDataURL('image/jpeg', 0.85))
    toast.success('Face captured for secure login.')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      if (otpChallengeId && selectedRole === 'student' && faceRequired && !capturedFace) {
        toast.error('Face capture is required to complete student login.')
        return
      }

      const response = await login({
        ...form,
        role: selectedRole,
        otpCode: otpChallengeId ? otpCode : undefined,
        otpChallengeId: otpChallengeId || undefined,
        faceImage: otpChallengeId ? capturedFace || undefined : undefined,
      })
      if (response?.otpRequired) {
        setOtpChallengeId(response.challengeId)
        setOtpSentTo(form.email)
        setFaceRequired(Boolean(response.faceRequired))
        toast.success(response.message || 'OTP sent to your email.')
        return
      }
      const user = response
      toast.success(`Welcome back, ${user.name}`)
      navigate(user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/student')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-auth px-4 py-8 text-slate-900 dark:text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl"
          animate={{ x: [0, 40, -10, 0], y: [0, 20, 40, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[-7rem] top-24 h-96 w-96 rounded-full bg-blue-500/16 blur-3xl"
          animate={{ x: [0, -50, 10, 0], y: [0, 30, -20, 0], scale: [1, 0.95, 1.05, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-5rem] left-[18%] h-80 w-80 rounded-full bg-emerald-400/12 blur-3xl"
          animate={{ x: [0, 60, 20, 0], y: [0, -20, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.1),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.09),_transparent_35%),linear-gradient(135deg,rgba(2,6,23,0.3),transparent_45%)]" />
      </div>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl">
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/80 shadow-2xl shadow-blue-950/10 backdrop-blur dark:bg-slate-950/75 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_28%)]" />
            <motion.div
              className="absolute right-10 top-10 h-32 w-32 rounded-full border border-white/10"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <div className="absolute inset-4 rounded-full border border-cyan-400/20" />
              <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
            </motion.div>
            <div className="relative">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Production-ready</p>
              <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[1.05]">Attendance Management System</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">A face-recognition-powered platform for secure sign-in, live attendance, analytics, exports, notifications, and role-based access across the full institution.</p>

              <div className="mt-8 grid gap-4">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_25px_50px_rgba(15,23,42,0.35)]">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-emerald-300" />
                    <p className="font-medium">JWT auth + face verification + role-based dashboards</p>
                  </div>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-300/90">Built for students, teachers, and admins with geo-fenced attendance, AI insights, and secure login verification.</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {[
                    ['Live face', 'Smart webcam attendance'],
                    ['Geo-fence', 'Campus-bound validation'],
                    ['AI layer', 'Summaries and alerts'],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">{title}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Realtime stack</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['Face recognition', 'Attendance analytics', 'Parent alerts', 'Secure OTP'].map((item) => (
                        <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <motion.div
                    className="rounded-[1.5rem] border border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 p-5"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">System trust</p>
                    <p className="mt-3 text-3xl font-semibold">99.2%</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Secure access flow with role checks, face validation, and attendance proof capture.</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <div className="mx-auto max-w-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Welcome back</p>
                <h2 className="mt-3 text-4xl font-semibold">Sign in</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use your teacher, student, or admin account to continue.</p>
              </div>
              <div className="hidden rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 sm:flex sm:items-center sm:gap-2">
                <Sparkles size={14} />
                Secure portal
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSearchParams({ role: 'student' })}
                className={`rounded-[1.5rem] border p-4 text-left transition ${selectedRole === 'student' ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:bg-blue-950/40' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}
              >
                <div className="flex items-center gap-3">
                  <GraduationCap size={18} />
                  <span className="font-medium">Student Login</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">View your attendance, profile, and history.</p>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ role: 'teacher' })}
                className={`rounded-[1.5rem] border p-4 text-left transition ${selectedRole === 'teacher' ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:bg-blue-950/40' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}
              >
                <div className="flex items-center gap-3">
                  <UserRoundCog size={18} />
                  <span className="font-medium">Teacher Login</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Manage students, scan faces, and export reports.</p>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ role: 'admin' })}
                className={`rounded-[1.5rem] border p-4 text-left transition ${selectedRole === 'admin' ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:bg-blue-950/40' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} />
                  <span className="font-medium">Admin Login</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Control teacher attendance, admin analytics, and institution access.</p>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-[1.75rem] border border-slate-200/80 bg-white/60 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/40">
              <input className="field" placeholder="Email address" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <div className="field flex items-center gap-3">
                <input className="w-full bg-transparent outline-none" placeholder="Password" type={showPassword ? 'text' : 'password'} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {selectedRole === 'student' ? (
                <>
                  <input className="field" placeholder="Parent email for alerts" type="email" required value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input className="field" placeholder="Parent name" value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} />
                    <input className="field" placeholder="Parent phone" value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} />
                  </div>
                </>
              ) : null}
              {otpChallengeId ? (
                <div className="space-y-3 rounded-[1.5rem] border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
                  <p className="font-medium">OTP verification required</p>
                  <p className="text-slate-500 dark:text-slate-400">Code sent to {otpSentTo}. Enter the 6-digit OTP to complete login.</p>
                  <input
                    className="field"
                    placeholder="Enter OTP"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  {selectedRole === 'student' && faceRequired ? (
                    <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="font-medium">Student face verification</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        This account already has a registered face profile, so login will only complete after the same student's face is verified.
                      </p>
                      <div className="overflow-hidden rounded-[1.25rem] bg-slate-950">
                        <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
                      </div>
                      {capturedFace ? <img src={capturedFace} alt="Captured login face" className="h-28 w-28 rounded-[1rem] object-cover" /> : null}
                      <div className="flex flex-wrap gap-3">
                        {cameraActive ? (
                          <>
                            <button type="button" onClick={captureFace} className="action-primary">
                              <Camera size={16} />
                              Capture face
                            </button>
                            <button type="button" onClick={stopCamera} className="action-secondary">
                              <Square size={16} />
                              Stop
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={startCamera} className="action-primary">
                            <Camera size={16} />
                            Start camera
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button className="action-primary w-full justify-center" disabled={loading}>
                {loading ? 'Signing in...' : otpChallengeId ? 'Verify OTP & login' : `Login as ${selectedRole}`}
              </button>
            </form>
            {selectedRole === 'student' ? (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                New here? <Link to="/signup?role=student" className="font-medium text-blue-600">Create a student account</Link>
              </p>
            ) : (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                {selectedRole === 'teacher'
                  ? 'Teacher access is admin-controlled. Only teacher accounts created by the admin can use teacher login.'
                  : 'Admin access uses the secured fixed credentials configured in the server environment.'}
              </p>
            )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
