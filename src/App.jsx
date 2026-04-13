import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import {
  Camera,
  Database,
  Download,
  Eye,
  Gauge,
  LoaderCircle,
  Moon,
  RefreshCw,
  ScanFace,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
  Users,
  Waves,
} from 'lucide-react'
import api, { getApiBaseUrl, setApiBaseUrl } from './api'

const DEFAULT_DATE = new Date().toISOString().slice(0, 10)
const SCAN_INTERVAL_MS = 2500
const CHART_COLORS = ['#295df5', '#18b7a6', '#f59e0b', '#ef4444', '#7c3aed']

function formatDay(value) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatTimestamp(value) {
  if (!value) return 'Just now'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function playSuccessTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const audioCtx = new AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = 740
    gain.gain.value = 0.08
    oscillator.connect(gain)
    gain.connect(audioCtx.destination)
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.15)
  } catch {
    // No audio support
  }
}

function StatCard({ icon: Icon, eyebrow, title, value, hint }) {
  return (
    <div className="stat-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className="icon-shell">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  )
}

function SectionHeader({ badge, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="section-badge">{badge}</div>
        <h2 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('fas_theme') === 'dark')
  const [backendUrl, setBackendUrl] = useState(() => getApiBaseUrl())
  const [backendHealthy, setBackendHealthy] = useState(false)
  const [backendMessage, setBackendMessage] = useState('Checking backend...')
  const [dashboard, setDashboard] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [students, setStudents] = useState([])
  const [filterDate, setFilterDate] = useState(DEFAULT_DATE)
  const [recordSearch, setRecordSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerDepartment, setRegisterDepartment] = useState('General')
  const [registerFile, setRegisterFile] = useState(null)
  const [registering, setRegistering] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [running, setRunning] = useState(false)
  const [streamReady, setStreamReady] = useState(false)
  const [status, setStatus] = useState('Standby')
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [matchedCount, setMatchedCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)

  const deferredStudentSearch = useDeferredValue(studentSearch)
  const deferredRecordSearch = useDeferredValue(recordSearch)
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const intervalRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('fas_theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    refreshAll()
  }, [])

  useEffect(() => {
    loadAttendance(filterDate)
  }, [filterDate])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const stats = dashboard?.stats || {
    total_students: 0,
    today_attendance: 0,
    attendance_rate: 0,
    avg_confidence: 0,
    weekly_average: 0,
  }

  const filteredStudents = useMemo(() => {
    const query = deferredStudentSearch.trim().toLowerCase()
    if (!query) return students
    return students.filter((student) =>
      [student.name, student.email, student.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [students, deferredStudentSearch])

  const filteredAttendance = useMemo(() => {
    const query = deferredRecordSearch.trim().toLowerCase()
    if (!query) return attendance
    return attendance.filter((record) =>
      [record.name, record.email, record.department, record.date, record.time]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [attendance, deferredRecordSearch])

  const topDepartment = dashboard?.departments?.[0]?.name || 'General'
  const themeLabel = dark ? 'Switch to light mode' : 'Switch to dark mode'

  async function refreshAll() {
    setLoadingData(true)
    setError('')
    try {
      const [healthRes, summaryRes, attendanceRes, studentsRes] = await Promise.all([
        api.get('/health'),
        api.get('/dashboard-summary'),
        api.get('/get-attendance', { params: { date: filterDate } }),
        api.get('/get-students'),
      ])

      setBackendHealthy(healthRes.data?.status === 'ok')
      setBackendMessage(healthRes.data?.message || 'Backend ready')
      startTransition(() => {
        setDashboard(summaryRes.data)
        setAttendance(attendanceRes.data?.records || [])
        setStudents(studentsRes.data?.students || [])
      })
    } catch (err) {
      setBackendHealthy(false)
      setBackendMessage(`Cannot reach backend at ${backendUrl}. Start Flask server from backend/app.py.`)
      setError(err?.response?.data?.error || err?.message || 'Unable to load dashboard data.')
    } finally {
      setLoadingData(false)
    }
  }

  async function loadAttendance(date) {
    setLoadingAttendance(true)
    try {
      const response = await api.get('/get-attendance', { params: { date } })
      startTransition(() => {
        setAttendance(response.data?.records || [])
      })
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to load attendance records.')
    } finally {
      setLoadingAttendance(false)
    }
  }

  async function checkBackend() {
    setBackendMessage('Checking backend...')
    try {
      const response = await api.get('/health')
      setBackendHealthy(response.data?.status === 'ok')
      setBackendMessage(response.data?.message || 'Backend ready')
      await refreshAll()
    } catch (err) {
      setBackendHealthy(false)
      setBackendMessage(`Cannot reach backend at ${backendUrl}.`)
      setError(err?.response?.data?.error || err?.message || 'Backend health check failed.')
    }
  }

  function saveBackendUrl() {
    const normalizedUrl = backendUrl.trim()
    if (!normalizedUrl) {
      setError('Backend URL cannot be empty.')
      return
    }
    setApiBaseUrl(normalizedUrl)
    checkBackend()
  }

  async function getCameraStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 960, height: 720, facingMode: 'user' },
      audio: false,
    })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
    setStreamReady(true)
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  }

  async function startCamera() {
    if (running) return
    if (!backendHealthy) {
      setError('Backend offline hai. Pehle backend URL save karke server start karo.')
      return
    }
    setError('')
    setStatus('Starting secure camera stream...')
    try {
      await getCameraStream()
      intervalRef.current = window.setInterval(sendFrame, SCAN_INTERVAL_MS)
      setRunning(true)
      setStatus('Live recognition active')
    } catch {
      setStatus('Camera unavailable')
      setError('Camera access allow karo, phir dubara start karo.')
    }
  }

  function stopCamera() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (videoRef.current?.srcObject) {
      for (const track of videoRef.current.srcObject.getTracks()) {
        track.stop()
      }
      videoRef.current.srcObject = null
    }
    setRunning(false)
    setStreamReady(false)
    setStatus('Standby')
  }

  async function sendFrame() {
    const image = captureFrame()
    if (!image) {
      setStatus('Waiting for camera frame...')
      return
    }

    try {
      const response = await api.post('/mark-attendance', { image_base64: image })
      const data = response.data

      if (data.matched) {
        if (!data.duplicate) {
          playSuccessTone()
          setMatchedCount((count) => count + 1)
        }
        setLastResult({
          name: data.student.name,
          tone: data.duplicate ? 'duplicate' : 'success',
          detail: data.duplicate ? 'Attendance already logged for today' : `Marked at ${data.attendance.time}`,
          confidence: Math.round((data.confidence || 0) * 100),
        })
        setStatus(`Recognized ${data.student.name}`)
      } else {
        setUnknownCount((count) => count + 1)
        setLastResult({
          name: 'Unknown face',
          tone: 'warning',
          detail: data.error || data.message || 'Face not recognized',
          confidence: Math.round((data.confidence || 0) * 100),
        })
        setStatus('Face not recognized')
      }

      await refreshAll()
    } catch (err) {
      setStatus('Recognition failed')
      setError(err?.response?.data?.error || err?.message || 'Failed to process camera frame.')
    }
  }

  async function registerStudent(event) {
    event.preventDefault()
    if (!registerName.trim() || !registerFile) {
      setError('Name aur image dono required hain.')
      return
    }

    setRegistering(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('name', registerName.trim())
      formData.append('email', registerEmail.trim())
      formData.append('department', registerDepartment.trim())
      formData.append('image', registerFile)

      await api.post('/register-student', formData)
      setRegisterName('')
      setRegisterEmail('')
      setRegisterDepartment('General')
      setRegisterFile(null)
      setStatus('New student enrolled successfully')
      await refreshAll()
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to register student.')
    } finally {
      setRegistering(false)
    }
  }

  async function deleteStudent(studentId) {
    try {
      await api.delete(`/students/${studentId}`)
      if (lastResult?.name && students.some((student) => student.id === studentId && student.name === lastResult.name)) {
        setLastResult(null)
      }
      await refreshAll()
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to remove student.')
    }
  }

  function downloadCsv() {
    const rows = [
      ['Name', 'Email', 'Department', 'Date', 'Time', 'Confidence'],
      ...filteredAttendance.map((record) => [
        record.name,
        record.email,
        record.department,
        record.date,
        record.time,
        record.confidence,
      ]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-${filterDate}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-app text-slate-900 transition-colors duration-300 dark:text-white">
      <div className="ambient-grid" />
      <div className="ambient-orb ambient-orb-left" />
      <div className="ambient-orb ambient-orb-right" />

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="hero-shell"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="section-badge">Vision-led Attendance OS</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Professional face attendance dashboard with a sharper operational UI.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100/80 sm:text-base">
                Live recognition, student onboarding, attendance history, and system analytics now sit in one polished control room built for admins and campus teams.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
              <div className="hero-metric">
                <span>Mode</span>
                <strong>{dashboard?.system?.storage_mode || 'Local JSON + OpenCV'}</strong>
              </div>
              <div className="hero-metric">
                <span>Recognition</span>
                <strong>{stats.avg_confidence}% avg confidence</strong>
              </div>
              <div className="hero-metric">
                <span>Live status</span>
                <strong>{backendHealthy ? 'Backend healthy' : 'Backend offline'}</strong>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-[1fr_auto]">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
              <input
                className="hero-input"
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
                placeholder="http://localhost:5000"
              />
              <button onClick={saveBackendUrl} className="hero-button-primary">
                <Database size={16} /> Save backend URL
              </button>
              <button onClick={checkBackend} className="hero-button-secondary">
                <RefreshCw size={16} /> Refresh sync
              </button>
            </div>

            <button onClick={() => setDark((value) => !value)} className="hero-button-secondary">
              {dark ? <Sun size={16} /> : <Moon size={16} />} {themeLabel}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <div className={`status-pill ${backendHealthy ? 'status-pill-ok' : 'status-pill-bad'}`}>
              <ShieldCheck size={16} />
              <span>{backendMessage}</span>
            </div>
            <div className="status-pill status-pill-muted">
              <Gauge size={16} />
              <span>{dashboard?.system?.recognition_engine || 'LBPH + Haar Cascade'}</span>
            </div>
            <div className="status-pill status-pill-muted">
              <Sparkles size={16} />
              <span>{topDepartment} is your largest student cluster</span>
            </div>
          </div>
        </motion.section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            eyebrow="Registered"
            title="Student roster"
            value={stats.total_students}
            hint="Total students enrolled into face recognition."
          />
          <StatCard
            icon={Eye}
            eyebrow="Today"
            title="Attendance hits"
            value={stats.today_attendance}
            hint={`${stats.attendance_rate}% of registered students marked today.`}
          />
          <StatCard
            icon={Waves}
            eyebrow="Quality"
            title="Recognition confidence"
            value={`${stats.avg_confidence}%`}
            hint="Average confidence across stored attendance records."
          />
          <StatCard
            icon={ScanFace}
            eyebrow="Weekly"
            title="7-day mean"
            value={stats.weekly_average}
            hint="Average attendance detections per day over the last week."
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="panel">
            <SectionHeader
              badge="Performance"
              title="Attendance momentum"
              description="Track how recognition volume moves across the week to spot quiet days and session surges."
            />
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard?.trend || []} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f6fff" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#4f6fff" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis dataKey="date" tickFormatter={formatDay} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '18px',
                      border: '1px solid rgba(148,163,184,0.18)',
                      background: 'rgba(15,23,42,0.92)',
                      color: '#fff',
                    }}
                    labelFormatter={(value) => formatDay(value)}
                  />
                  <Area type="monotone" dataKey="count" stroke="#4f6fff" strokeWidth={3} fill="url(#attendanceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <SectionHeader
              badge="Distribution"
              title="Department mix"
              description="See which teams or academic groups are currently represented in the recognition database."
            />
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard?.departments || []} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '18px',
                      border: '1px solid rgba(148,163,184,0.18)',
                      background: 'rgba(15,23,42,0.92)',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {(dashboard?.departments || []).map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="panel">
            <SectionHeader
              badge="Live Vision"
              title="Recognition console"
              description="Run the camera feed, inspect the latest decision, and keep a quick watch on unknown detections."
              action={
                <div className="flex gap-3">
                  <button onClick={running ? stopCamera : startCamera} className="button-primary">
                    {running ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />}
                    {running ? 'Stop scan' : 'Start scan'}
                  </button>
                  <button
                    onClick={() => {
                      setMatchedCount(0)
                      setUnknownCount(0)
                      setLastResult(null)
                      setError('')
                      setStatus('Standby')
                    }}
                    className="button-secondary"
                  >
                    <RefreshCw size={16} />
                    Reset panel
                  </button>
                </div>
              }
            />

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="camera-shell">
                <video ref={videoRef} className="h-full min-h-[22rem] w-full rounded-[1.75rem] object-cover" playsInline muted />
                <div className="scan-line" />
                {!streamReady && (
                  <div className="camera-overlay">
                    <div>
                      <p className="text-sm uppercase tracking-[0.35em] text-blue-200">Camera idle</p>
                      <p className="mt-3 text-2xl font-semibold text-white">Start scan to begin live attendance recognition</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="mini-panel">
                  <p className="mini-label">Current status</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{status}</p>
                  {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="mini-panel">
                    <p className="mini-label">Matched</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{matchedCount}</p>
                  </div>
                  <div className="mini-panel">
                    <p className="mini-label">Unknown</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{unknownCount}</p>
                  </div>
                </div>

                <div className="mini-panel">
                  <p className="mini-label">Latest decision</p>
                  {lastResult ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-semibold text-slate-950 dark:text-white">{lastResult.name}</p>
                        <span className={`decision-pill decision-pill-${lastResult.tone}`}>{lastResult.confidence}%</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{lastResult.detail}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Recognition results will appear here after the first scan.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <SectionHeader
              badge="Enrollment"
              title="Add a new student"
              description="Upload a clear face image to train the local recognizer and make the student available for live attendance."
            />
            <form onSubmit={registerStudent} className="mt-6 space-y-4">
              <input
                className="field-input"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                placeholder="Full name"
                required
              />
              <input
                className="field-input"
                type="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="Email address"
              />
              <input
                className="field-input"
                value={registerDepartment}
                onChange={(event) => setRegisterDepartment(event.target.value)}
                placeholder="Department or batch"
              />
              <label className="upload-shell">
                <UploadCloud size={18} />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{registerFile ? registerFile.name : 'Choose a student image'}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use a bright, front-facing face photo for best recognition quality.</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setRegisterFile(event.target.files?.[0] || null)}
                />
              </label>
              <button type="submit" disabled={registering} className="button-primary w-full justify-center">
                {registering ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {registering ? 'Enrolling student...' : 'Enroll student'}
              </button>
            </form>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-medium text-slate-900 dark:text-white">System note</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Current backend stores students and attendance locally as JSON, which keeps the app fully functional without extra setup.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="panel">
            <SectionHeader
              badge="Registry"
              title="Student directory"
              description="Browse and prune enrolled students to keep the recognition database clean."
              action={
                <div className="search-shell w-full md:w-72">
                  <Search size={16} />
                  <input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search students"
                  />
                </div>
              }
            />

            <div className="mt-6 space-y-3">
              {filteredStudents.length === 0 ? (
                <div className="empty-shell">No registered students found.</div>
              ) : (
                filteredStudents.map((student) => (
                  <div key={student.id} className="list-row">
                    <div className="avatar-shell">
                      {student.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-950 dark:text-white">{student.name}</p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{student.email || 'No email added'}</p>
                    </div>
                    <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:block">
                      {student.department || 'General'}
                    </div>
                    <button onClick={() => deleteStudent(student.id)} className="icon-button" title="Delete student">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <SectionHeader
              badge="Records"
              title="Attendance ledger"
              description="Filter today's records, search by student or department, and export a clean CSV for reporting."
              action={
                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                  <label className="date-shell">
                    <span>Date</span>
                    <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
                  </label>
                  <button onClick={downloadCsv} className="button-secondary">
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              }
            />

            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="search-shell md:w-80">
                <Search size={16} />
                <input
                  value={recordSearch}
                  onChange={(event) => setRecordSearch(event.target.value)}
                  placeholder="Search attendance records"
                />
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {filteredAttendance.length} record(s) on {formatDay(filterDate)}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200/80 dark:border-slate-800">
              <div className="grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr] gap-4 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                <span>Student</span>
                <span>Department</span>
                <span>Time</span>
                <span>Confidence</span>
              </div>
              <div className="max-h-[27rem] overflow-y-auto bg-white dark:bg-slate-950/60">
                {loadingAttendance || loadingData ? (
                  <div className="empty-shell">Loading attendance records...</div>
                ) : filteredAttendance.length === 0 ? (
                  <div className="empty-shell">No attendance recorded for the selected view.</div>
                ) : (
                  filteredAttendance.map((record) => (
                    <div key={record.record_id} className="grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr] gap-4 border-t border-slate-200/70 px-5 py-4 text-sm dark:border-slate-800">
                      <div>
                        <p className="font-semibold text-slate-950 dark:text-white">{record.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.email || 'No email'}</p>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{record.department}</div>
                      <div className="text-slate-600 dark:text-slate-300">{record.time}</div>
                      <div>
                        <span className="decision-pill decision-pill-info">{Math.round((record.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="panel">
            <SectionHeader
              badge="System"
              title="Operations snapshot"
              description="A concise backend status view for deployments, local demos, and day-to-day monitoring."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="mini-panel">
                <p className="mini-label">Storage mode</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{dashboard?.system?.storage_mode || 'Local JSON + OpenCV'}</p>
              </div>
              <div className="mini-panel">
                <p className="mini-label">Engine</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{dashboard?.system?.recognition_engine || 'LBPH + Haar Cascade'}</p>
              </div>
              <div className="mini-panel">
                <p className="mini-label">Backend health</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{backendHealthy ? 'Healthy' : 'Offline'}</p>
              </div>
              <div className="mini-panel">
                <p className="mini-label">Last sync</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{formatTimestamp(dashboard?.system?.last_sync)}</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <SectionHeader
              badge="Activity"
              title="Recent attendance events"
              description="A compact feed of the latest attendance marks for audit-friendly visibility."
            />
            <div className="mt-6 space-y-3">
              {(dashboard?.recent_activity || []).length === 0 ? (
                <div className="empty-shell">Recent activity will show up after attendance marks are recorded.</div>
              ) : (
                dashboard.recent_activity.map((record, index) => (
                  <div key={`${record.record_id}-${index}`} className="timeline-row">
                    <div className="timeline-dot" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-slate-950 dark:text-white">{record.name}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{formatTimestamp(record.timestamp)}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {record.department} | {record.time} | confidence {Math.round((record.confidence || 0) * 100)}%
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
