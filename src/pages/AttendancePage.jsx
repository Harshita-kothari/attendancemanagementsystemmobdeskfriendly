import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, CameraOff, CheckCircle2, AlertCircle, UserCheck, Zap, Shield, RefreshCw, StopCircle, UserPlus } from 'lucide-react'
import api from '../api'
import { MOCK_STUDENTS } from '../data/mockData'

const SCAN_INTERVAL = 2500

export default function AttendancePage() {
  const [running, setRunning] = useState(false)
  const [recognized, setRecognized] = useState([])
  const [currentFace, setCurrentFace] = useState(null)
  const [scanStatus, setScanStatus] = useState('idle')
  const [spoofAlert, setSpoofAlert] = useState(false)
  const [faceBox, setFaceBox] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Start the camera to begin recognition.')
  const [cameraError, setCameraError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', role: 'student', department: 'B.Tech CSE' })
  const [isRegistering, setIsRegistering] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const matchRef = useRef({ id: null, streak: 0 })
  const currentFrameRef = useRef(null)

  const stopCamera = useCallback(async () => {
    clearInterval(timerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    try {
      await api.get('/stop-attendance')
    } catch (err) {
      console.warn('Unable to stop backend session:', err)
    }
    setRunning(false)
    setScanStatus('idle')
    setFaceBox(null)
    setCurrentFace(null)
    setStatusMessage('Start the camera to begin recognition.')
    setCameraError('')
    matchRef.current = { id: null, streak: 0 }
  }, [])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null

    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
  }, [])

  const recognizeFace = useCallback(async () => {
    if (!running || !streamRef.current) return
    const imageBase64 = captureFrame()
    if (!imageBase64) {
      setStatusMessage('Waiting for camera feed...')
      return
    }

    setScanStatus('scanning')
    setStatusMessage('Scanning face...')

    try {
      const response = await api.post('/api/face/recognize', { image_base64: imageBase64 })
      const data = response.data

      if (data.status === 'spoof_detected') {
        setScanStatus('spoof')
        setSpoofAlert(true)
        setStatusMessage('Liveness check failed — possible spoof attempt.')
        setFaceBox({ x: 22, y: 18, w: 56, h: 64 })
        setTimeout(() => setSpoofAlert(false), 2200)
        return
      }

      if (data.matched) {
        const student = data.student
        const same = matchRef.current.id === student.id
        matchRef.current = {
          id: student.id,
          streak: same ? matchRef.current.streak + 1 : 1,
        }

        if (matchRef.current.streak >= 2 || !currentFace || currentFace.id !== student.id) {
          const updatedFace = {
            id: student.id,
            name: student.name,
            rollNo: student.roll_no || student.rollNo || 'N/A',
            department: student.department || 'Unknown',
            avatar: student.avatar || student.name.split(' ').map((part) => part[0]).join('').toUpperCase(),
            status: student.status || (data.confidence >= 0.75 ? 'present' : 'late'),
            confidence: (data.confidence || 0).toFixed(2),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }

          setCurrentFace(updatedFace)
          setScanStatus('matched')
          setStatusMessage(`Recognized ${student.name}`)
          setFaceBox({ x: 22, y: 18, w: 56, h: 64 })

          const attendanceData = {
            student_id: student.id,
            date: new Date().toISOString().split('T')[0],
            entry_time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            status: 'present',
          }
          await api.post('/api/attendance/mark', attendanceData)

          setRecognized((prev) => {
            if (prev.find((r) => r.id === student.id)) return prev
            return [updatedFace, ...prev]
          })
        }
      } else {
        setScanStatus('failed')
        setStatusMessage('No matching face found.')
        setFaceBox({ x: 22, y: 18, w: 56, h: 64 })
        setShowRegister(true)
        currentFrameRef.current = imageBase64
      }
    } catch (error) {
      console.error(error)
      setScanStatus('failed')
      const message = error?.response?.data?.detail || error?.message || 'Recognition service error. Check backend.'
      setStatusMessage(message)
    }
  }, [captureFrame, currentFace, running])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setRunning(true)
      setScanStatus('scanning')
      setStatusMessage('Camera active. Scanning face...')
    } catch (err) {
      console.error(err)
      setCameraError('Camera access denied or unavailable. Please allow camera permission.')
      setScanStatus('failed')
      setStatusMessage('Camera unavailable.')
    }
  }, [])

  useEffect(() => {
    if (!running || !streamRef.current) return
    recognizeFace()
    timerRef.current = window.setInterval(recognizeFace, SCAN_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [running, recognizeFace])

  useEffect(() => () => stopCamera(), [stopCamera])

  const handleStart = async () => {
    stopCamera()
    setRecognized([])
    matchRef.current = { id: null, streak: 0 }
    setStatusMessage('Initializing attendance session...')

    try {
      await api.get('/start-attendance?duration=25')
      setStatusMessage('Backend attendance session started. Opening camera...')
    } catch (err) {
      console.error('Start attendance failed:', err)
      setStatusMessage('Unable to start backend attendance session.')
    }

    startCamera()
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!currentFrameRef.current || isRegistering) return

    setIsRegistering(true)
    setStatusMessage('Registering face...')
    try {
      // Convert base64 to blob
      const base64Data = currentFrameRef.current.replace(/^data:image\/[a-z]+;base64,/, '')
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('file', blob, 'face.jpg')
      formData.append('name', registerForm.name)
      formData.append('email', registerForm.email)
      formData.append('role', registerForm.role)
      formData.append('department', registerForm.department)

      const response = await api.post('/api/face/register-live', formData)

      const student = response.data.student
      const newAttendance = {
        id: student.id,
        name: student.name,
        rollNo: student.roll_no || 'N/A',
        department: student.department || 'Unknown',
        avatar: student.avatar || student.name.split(' ').map(p => p[0]).join('').toUpperCase(),
        status: 'present',
        confidence: '1.00',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }

      setRecognized(prev => [newAttendance, ...prev])
      setCurrentFace(newAttendance)
      setScanStatus('matched')
      setStatusMessage(`Registered and marked attendance for ${student.name}`)
      setShowRegister(false)
      setRegisterForm({ name: '', email: '', role: 'student', department: 'B.Tech CSE' })
      currentFrameRef.current = null
    } catch (error) {
      console.error(error)
      const message = error?.response?.data?.detail || error?.message || 'Registration failed. Try again.'
      setStatusMessage(message)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleManualRegister = () => {
    const imageBase64 = captureFrame()
    if (!imageBase64) {
      setStatusMessage('Start the camera and look into the frame, then try manual registration again.')
      return
    }
    currentFrameRef.current = imageBase64
    setShowRegister(true)
    setStatusMessage('Face captured. Fill the form to register and mark attendance.')
  }

  const handleReset = () => {
    stopCamera()
    setRecognized([])
    setCurrentFace(null)
    setStatusMessage('Start the camera to begin recognition.')
    setShowRegister(false)
    setRegisterForm({ name: '', email: '', role: 'student', department: 'B.Tech CSE' })
    currentFrameRef.current = null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Live Attendance</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Real-time face recognition · Anti-spoofing enabled</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Reset
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-4">
            <div className="relative bg-surface-900 dark:bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

              {!running && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-800 to-surface-900">
                  <div className="text-center text-surface-500">
                    <Camera size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm opacity-50">Camera feed ready</p>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-center px-6">
                  <div>
                    <p className="text-sm font-semibold">{cameraError}</p>
                    <p className="text-xs text-surface-400 mt-2">Allow camera permissions and reload the page.</p>
                  </div>
                </div>
              )}

              {running && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute left-0 right-0 h-0.5 bg-brand-400/60 animate-scan" style={{ boxShadow: '0 0 8px #60a5fa' }} />
                </div>
              )}

              {faceBox && running && (
                <div className="absolute pointer-events-none face-box face-box-corners"
                  style={{ left: `${faceBox.x}%`, top: `${faceBox.y}%`, width: `${faceBox.w}%`, height: `${faceBox.h}%` }}>
                  {scanStatus === 'matched' && currentFace && (
                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-medium">
                        {currentFace.name}
                      </span>
                    </div>
                  )}
                  {scanStatus === 'spoof' && (
                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">SPOOF DETECTED</span>
                    </div>
                  )}
                </div>
              )}

              {!running && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button onClick={handleStart} className="btn-primary flex items-center gap-2 text-sm shadow-xl">
                    <Camera size={18} /> Start Recognition
                  </button>
                </div>
              )}

              <div className="absolute top-3 left-3 flex gap-2">
                {running && (
                  <span className="flex items-center gap-1.5 text-xs font-medium bg-black/60 text-white backdrop-blur px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
                {running && (
                  <span className="flex items-center gap-1.5 text-xs font-medium bg-black/60 text-white backdrop-blur px-2.5 py-1 rounded-full">
                    <Shield size={11} className="text-emerald-400" /> Anti-Spoof ON
                  </span>
                )}
              </div>

              {spoofAlert && (
                <div className="absolute inset-0 border-4 border-red-500 rounded-xl pointer-events-none animate-pulse">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <AlertCircle size={16} /> SPOOFING ATTEMPT BLOCKED
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              {running ? (
                <>
                  <button onClick={stopCamera} className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                    <StopCircle size={16} /> Stop
                  </button>
                  <button onClick={handleManualRegister} className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm">
                    <UserPlus size={16} /> Register Face Manually
                  </button>
                </>
              ) : (
                <button onClick={handleStart} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                  <Camera size={16} /> Start
                </button>
              )}
            </div>

            <div className="mt-4 p-4 rounded-3xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-950">
              <p className="text-xs uppercase tracking-[0.3em] text-surface-500 dark:text-surface-400 mb-2">Status</p>
              <p className="text-sm font-medium text-surface-900 dark:text-white">{scanStatus === 'matched' ? 'Face matched' : scanStatus === 'spoof' ? 'Spoof detected' : scanStatus === 'failed' ? 'No match' : 'Idle'}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{statusMessage}</p>
            </div>
          </div>

          {showRegister && (
            <div className="card p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus size={16} className="text-amber-600" />
                <p className="font-semibold text-surface-900 dark:text-white">Register New Face</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={registerForm.name} onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))} type="text" className="input" placeholder="Full name" required />
                  <input value={registerForm.email} onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))} type="email" className="input" placeholder="Email" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={registerForm.role} onChange={(e) => setRegisterForm(prev => ({ ...prev, role: e.target.value }))} className="input" required>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input value={registerForm.department} onChange={(e) => setRegisterForm(prev => ({ ...prev, department: e.target.value }))} type="text" className="input" placeholder="Department" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isRegistering} className="flex-1 btn-primary text-sm">
                    {isRegistering ? 'Registering...' : 'Register & Mark Attendance'}
                  </button>
                  <button type="button" onClick={() => setShowRegister(false)} className="btn-ghost text-sm">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Recognized',  value: recognized.length, color: 'text-emerald-600' },
              { label: 'Present',     value: recognized.filter((r) => r.status === 'present').length, color: 'text-brand-600' },
              { label: 'Late',        value: recognized.filter((r) => r.status === 'late').length, color: 'text-amber-500' },
            ].map((s) => (
              <div key={s.label} className="card p-3 text-center">
                <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card flex flex-col overflow-hidden" style={{ maxHeight: 620 }}>
          <div className="p-4 border-b border-surface-100 dark:border-surface-700/50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-brand-500" />
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Recognition Log</h3>
            </div>
            <span className="badge-blue">{recognized.length} marked</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {recognized.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-surface-300 dark:text-surface-600">
                <UserCheck size={28} className="mb-2" />
                <p className="text-sm">No attendance marked yet</p>
              </div>
            ) : recognized.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/50 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors animate-slide-up">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {r.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{r.name}</p>
                  <p className="text-xs text-surface-400">{r.rollNo}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={r.status === 'late' ? 'badge-yellow' : 'badge-green'}>{r.status}</span>
                  <span className="text-xs text-surface-400 font-mono">{r.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
