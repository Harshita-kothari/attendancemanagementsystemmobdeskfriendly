import { BadgeAlert, CalendarDays, Download, LayoutDashboard, MapPin, MessageSquareMore, ScanFace, Search, Send, ShieldAlert, Sparkles, Square, UserCheck, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLocation } from 'react-router-dom'
import api from '../lib/api'
import { AIChatAssistant } from '../components/AIChatAssistant'
import { DashboardLayout } from '../components/DashboardLayout'
import { FaceCapture } from '../components/FaceCapture'
import { useTheme } from '../context/ThemeContext'

const sidebar = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/check-in', label: 'Check-In', icon: UserCheck },
  { to: '/teacher/attendance', label: 'Live Attendance', icon: ScanFace },
  { to: '/teacher/assistant', label: 'AI Assistant', icon: MessageSquareMore },
]

export function TeacherDashboard() {
  const location = useLocation()
  const { alertsEnabled } = useTheme()
  const [summary, setSummary] = useState(null)
  const [students, setStudents] = useState([])
  const [records, setRecords] = useState([])
  const [teacherProfile, setTeacherProfile] = useState(null)
  const [teacherRecords, setTeacherRecords] = useState([])
  const [teacherLatest, setTeacherLatest] = useState(null)
  const [teacherFaceImages, setTeacherFaceImages] = useState([])
  const [selectedStudentSummary, setSelectedStudentSummary] = useState(null)
  const [studentSummaryLoading, setStudentSummaryLoading] = useState('')
  const [studentActionLoading, setStudentActionLoading] = useState('')
  const [search, setSearch] = useState('')
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    password: '',
    department: 'General',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
  })
  const [faceImages, setFaceImages] = useState([])
  const [scanStatus, setScanStatus] = useState('Idle')
  const [captureError, setCaptureError] = useState('')
  const [teacherScanStatus, setTeacherScanStatus] = useState('Ready for teacher check-in.')
  const [teacherScanError, setTeacherScanError] = useState('')
  const [teacherFaceSaving, setTeacherFaceSaving] = useState(false)
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))
  const [calendarEvents, setCalendarEvents] = useState([])
  const [correctingAttendanceId, setCorrectingAttendanceId] = useState('')
  const [calendarForm, setCalendarForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: '',
    type: 'no-class',
    time: '',
  })
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))

  useEffect(() => {
    loadAll()
    requestNotificationPermission()
  }, [])

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // Ignore notification permission errors.
      }
    }
  }

  function playAttendanceTone(type = 'success') {
    if (typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const audioContext = new AudioContextClass()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    const now = audioContext.currentTime
    const frequencies = type === 'success' ? [660, 880, 1040] : [280, 220, 180]
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    frequencies.forEach((frequency, index) => {
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.12)
    })
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + frequencies.length * 0.12)
    oscillator.start(now)
    oscillator.stop(now + frequencies.length * 0.12 + 0.02)
    oscillator.onended = () => {
      audioContext.close().catch(() => {})
    }
  }

  function showBrowserNotification(title, body) {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  }

  async function getGpsLocation() {
    if (!navigator.geolocation) return null
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      )
    })
  }

  async function loadAll() {
    const [summaryRes, studentsRes, recordsRes, teacherAttendanceRes, calendarRes] = await Promise.all([
      api.get('/api/attendance/teacher-summary'),
      api.get('/api/students'),
      api.get('/api/attendance'),
      api.get('/api/teacher-attendance/me'),
      api.get('/api/academic-calendar'),
    ])
    setSummary(summaryRes.data)
    setStudents(studentsRes.data.students)
    setRecords(recordsRes.data.records)
    setTeacherProfile(teacherAttendanceRes.data.teacher)
    setTeacherRecords(teacherAttendanceRes.data.records || [])
    setTeacherLatest(teacherAttendanceRes.data.latestRecord || null)
    setCalendarEvents(calendarRes.data.events || [])
  }

  async function saveCalendarDay(event) {
    event.preventDefault()
    try {
      const { data } = await api.post('/api/academic-calendar', {
        ...calendarForm,
        skipAttendance: calendarForm.type === 'holiday' || calendarForm.type === 'no-class',
      })
      setCalendarEvents(data.events || [])
      setCalendarForm((current) => ({ ...current, title: '', time: '', type: 'no-class' }))
      if (alertsEnabled) toast.success(data.message || 'Calendar updated successfully')
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to save calendar day')
    }
  }

  async function createStudent(event) {
    event.preventDefault()
    try {
      await api.post('/api/students', { ...newStudent, faceImages })
      if (alertsEnabled) {
        toast.success('Student added successfully')
      }
      setNewStudent({ name: '', email: '', password: '', department: 'General', parentName: '', parentEmail: '', parentPhone: '' })
      setFaceImages([])
      loadAll()
    } catch (error) {
      if (alertsEnabled) {
        toast.error(error.response?.data?.message || 'Unable to add student')
      }
    }
  }

  async function deleteStudent(id) {
    await api.delete(`/api/students/${id}`)
    if (alertsEnabled) {
      toast.success('Student deleted')
    }
    loadAll()
  }

  async function openStudentSummary(studentId) {
    try {
      setStudentSummaryLoading(studentId)
      const { data } = await api.get(`/api/students/${studentId}/summary`)
      setSelectedStudentSummary(data)
    } catch (error) {
      if (alertsEnabled) {
        toast.error(error.response?.data?.message || 'Unable to load AI student summary')
      }
    } finally {
      setStudentSummaryLoading('')
    }
  }

  async function triggerStudentAction(actionType) {
    if (!selectedStudentSummary?.student?.id) return
    try {
      setStudentActionLoading(actionType)
      const { data } = await api.post(`/api/students/${selectedStudentSummary.student.id}/intervention`, {
        actionType,
        note: selectedStudentSummary?.intervention?.summary || '',
      })
      if (alertsEnabled) {
        toast.success(data.message)
      }
      await Promise.all([loadAll(), openStudentSummary(selectedStudentSummary.student.id)])
    } catch (error) {
      if (alertsEnabled) {
        toast.error(error.response?.data?.message || 'Unable to complete intervention')
      }
    } finally {
      setStudentActionLoading('')
    }
  }

  async function exportCsv() {
    const response = await api.get('/api/attendance/export/csv', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = 'attendance-report.csv'
    link.click()
  }

  async function exportPdf() {
    const { data } = await api.get('/api/attendance', {
      params: {
        month: reportMonth,
      },
    })
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Monthly Attendance Report', 14, 16)
    doc.setFontSize(11)
    doc.text(`Month: ${reportMonth}`, 14, 25)
    doc.text(`Total records: ${data.records.length}`, 14, 32)
    autoTable(doc, {
      startY: 40,
      head: [['Student', 'Department', 'Date', 'Time', 'Status', 'Engagement', 'Reason AI', 'Security']],
      body: data.records.map((record) => [
        record.student?.name,
        record.student?.department,
        record.date,
        record.time,
        record.status,
        `${record.engagementScore || 0}% ${record.emotionState || 'attentive'}`,
        record.justification?.aiLabel ? `${record.justification.aiLabel} · ${record.justification.trustScore || 0}` : (record.status === 'absent' ? 'Pending' : '-'),
        record.suspicious ? 'Suspicious' : 'Clean',
      ]),
    })
    doc.save(`attendance-report-${reportMonth}.pdf`)
  }

  async function startScan() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    videoRef.current.srcObject = stream
    await videoRef.current.play()
    setScanStatus('Camera active')
    setTeacherScanStatus('Camera active')
  }

  function stopScan() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setScanStatus('Camera stopped')
    setTeacherScanStatus('Camera stopped')
  }

  async function markAttendance() {
    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      const image = canvas.toDataURL('image/jpeg', 0.85)
      const gps = await getGpsLocation()
      const { data } = await api.post('/api/attendance/scan', {
        image,
        locationLabel: 'Teacher Dashboard Scanner',
        gps,
      })
      setScanStatus(data.notification)
      setCaptureError('')
      if (alertsEnabled) {
        playAttendanceTone('success')
        toast.success(data.notification)
        showBrowserNotification('Attendance marked', data.notification)
      }
      loadAll()
    } catch (error) {
      const message = error.response?.data?.message || 'Face mismatch warning'
      setCaptureError(message)
      if (alertsEnabled) {
        playAttendanceTone(error.response?.data?.record?.status === 'absent' ? 'error' : 'error')
        toast.error(message)
        showBrowserNotification(error.response?.data?.record?.status === 'absent' ? 'Attendance marked absent' : 'Attendance alert', message)
      }
    }
  }

  async function registerTeacherFace() {
    if (teacherFaceImages.length < 5) {
      if (alertsEnabled) toast.error('Teacher face registration ke liye kam se kam 5 samples capture karo.')
      return
    }
    try {
      setTeacherFaceSaving(true)
      const { data } = await api.post('/api/teachers/me/register-face', { faceImages: teacherFaceImages })
      setTeacherProfile(data.teacher)
      setTeacherScanStatus(data.message)
      if (alertsEnabled) toast.success(data.message)
      setTeacherFaceImages([])
    } catch (error) {
      const ownerEmail = error.response?.data?.ownerEmail
      const ownerRole = error.response?.data?.ownerRole
      const message = ownerEmail
        ? `${error.response?.data?.message || 'Unable to register teacher face'} Existing ${ownerRole || 'account'}: ${ownerEmail}`
        : (error.response?.data?.message || 'Unable to register teacher face')
      setTeacherScanError(message)
      if (alertsEnabled) toast.error(message)
    } finally {
      setTeacherFaceSaving(false)
    }
  }

  async function markTeacherAttendance() {
    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        throw new Error('Camera ready hone do, phir check-in karo.')
      }
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      const image = canvas.toDataURL('image/jpeg', 0.85)
      const gps = await getGpsLocation()
      const { data } = await api.post('/api/teacher-attendance/scan', {
        image,
        gps,
        locationLabel: 'Teacher Check-In Console',
      })
      setTeacherLatest(data.record)
      setTeacherRecords((current) => {
        const next = [data.record, ...current.filter((item) => item.id !== data.record.id)]
        return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      })
      setTeacherScanStatus(data.notification)
      setTeacherScanError('')
      if (alertsEnabled) {
        playAttendanceTone('success')
        toast.success(data.notification)
        showBrowserNotification('Teacher attendance marked', data.notification)
      }
    } catch (error) {
      const detail = error.response?.data?.detail
      const message = error.response?.data?.message || error.message || 'Teacher check-in failed'
      const combinedMessage = detail && detail !== message ? `${message} ${detail}` : message
      setTeacherScanError(combinedMessage)
      if (alertsEnabled) {
        playAttendanceTone(error.response?.data?.record?.status === 'absent' ? 'error' : 'error')
        toast.error(combinedMessage)
        showBrowserNotification(error.response?.data?.record?.status === 'absent' ? 'Teacher marked absent' : 'Teacher attendance alert', combinedMessage)
      }
    }
  }

  async function correctStudentAttendance(recordId) {
    try {
      setCorrectingAttendanceId(recordId)
      const { data } = await api.post(`/api/attendance/${recordId}/override-present`, {
        note: 'Teacher corrected a wrongly marked absent record.',
      })
      if (alertsEnabled) {
        playAttendanceTone('success')
        toast.success(data.message)
        showBrowserNotification('Attendance corrected', data.message)
      }
      await loadAll()
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to correct student attendance.'
      if (alertsEnabled) {
        playAttendanceTone('error')
        toast.error(message)
        showBrowserNotification('Attendance correction failed', message)
      }
    } finally {
      setCorrectingAttendanceId('')
    }
  }

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return students
    return students.filter((student) =>
      [student.name, student.email, student.department, student.studentCode].some((value) =>
        String(value || '').toLowerCase().includes(query),
      ),
    )
  }, [students, search])

  const recentAbsentRecords = useMemo(
    () => records.filter((record) => record.status === 'absent').slice(0, 8),
    [records],
  )

  const interventionActionMeta = {
    'send-warning': { label: 'Send Warning', tone: 'bg-amber-500/10 text-amber-500' },
    'notify-parent': { label: 'Notify Parent', tone: 'bg-blue-500/10 text-blue-500' },
    'schedule-meeting': { label: 'Schedule Meeting', tone: 'bg-fuchsia-500/10 text-fuchsia-500' },
    'extra-assignment': { label: 'Extra Assignment', tone: 'bg-cyan-500/10 text-cyan-500' },
    monitor: { label: 'Monitor', tone: 'bg-emerald-500/10 text-emerald-500' },
  }

  const interventionCards = [
    ['send-warning', summary?.interventionAnalytics?.actionBreakdown?.['send-warning'] || 0],
    ['notify-parent', summary?.interventionAnalytics?.actionBreakdown?.['notify-parent'] || 0],
    ['schedule-meeting', summary?.interventionAnalytics?.actionBreakdown?.['schedule-meeting'] || 0],
    ['extra-assignment', summary?.interventionAnalytics?.actionBreakdown?.['extra-assignment'] || 0],
    ['monitor', summary?.interventionAnalytics?.actionBreakdown?.monitor || 0],
  ]

  const currentPage = location.pathname.endsWith('/students')
    ? 'students'
    : location.pathname.endsWith('/check-in')
      ? 'checkin'
    : location.pathname.endsWith('/attendance')
      ? 'attendance'
      : location.pathname.endsWith('/assistant')
        ? 'assistant'
      : 'dashboard'

  const pageMeta = {
    dashboard: {
      title: 'Teacher Command Center',
      subtitle: 'Manage students, track live attendance, export reports, and monitor analytics from one secure workspace.',
    },
    students: {
      title: 'Student Management',
      subtitle: 'Add students, capture face datasets, search, and remove student accounts.',
    },
    checkin: {
      title: 'Teacher Live Check-In',
      subtitle: 'Mark your own teacher attendance with face verification, geo-fence validation, proof capture, and late detection.',
    },
    attendance: {
      title: 'Live Attendance Scanner',
      subtitle: 'Scan faces live and mark attendance instantly with time and confidence.',
    },
    assistant: {
      title: 'AI Chatbot Assistant',
      subtitle: 'Ask for teacher summaries, suspicious activity insights, and smart attendance guidance from one chat workspace.',
    },
  }

  return (
    <DashboardLayout
      sidebar={sidebar}
      title={pageMeta[currentPage].title}
      subtitle={pageMeta[currentPage].subtitle}
    >
      {currentPage === 'dashboard' ? (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Students', summary?.stats?.totalStudents || 0],
              ['Today', summary?.stats?.todayAttendance || 0],
              ['Rate', `${summary?.stats?.attendanceRate || 0}%`],
              ['Low attendance', summary?.stats?.lowAttendanceCount || 0],
              ['Suspicious', summary?.stats?.suspiciousCount || 0],
              ['Parent alerts', summary?.stats?.parentAlertCount || 0],
              ['Reason pending', summary?.stats?.justificationPendingCount || 0],
              ['Fake reasons', summary?.stats?.fakeReasonCount || 0],
              ['Interventions', summary?.stats?.interventionCount || 0],
              ['Success rate', `${summary?.stats?.interventionSuccessRate || 0}%`],
            ].map(([label, value]) => (
              <div key={label} className="card-panel p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card-panel h-80 p-5">
              <p className="text-lg font-semibold">Monthly attendance trend</p>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary?.monthlyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-panel h-80 p-5">
              <p className="text-lg font-semibold">Department distribution</p>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary?.departmentStats || []} dataKey="value" nameKey="name" outerRadius={85} fill="#06b6d4" />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-panel p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Proxy alerts</p>
                <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">
                  {summary?.suspiciousRecords?.length || 0} flagged
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {(summary?.suspiciousRecords || []).map((record) => (
                  <div key={record.id} className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50/90 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{record.student?.name || 'Unknown student'}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{record.date} at {record.time}</p>
                    <div className="mt-2 space-y-1 text-xs text-rose-700 dark:text-rose-200">
                      {(record.suspiciousFlags || []).map((flag) => (
                        <p key={flag.code}>[{flag.label}] {flag.detail}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {!summary?.suspiciousRecords?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No suspicious attendance detected yet.</p> : null}
              </div>
            </div>

            <div className="card-panel p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Parent notifications</p>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-500">
                  {summary?.parentAlerts?.length || 0} recent
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {(summary?.parentAlerts || []).map((alert) => (
                  <div key={alert.id} className="rounded-[1.25rem] border border-blue-300/70 bg-blue-50/90 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{alert.studentName}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{alert.parentContact?.email || alert.parentContact?.phone || 'No recipient'}</p>
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">{alert.message}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">{alert.deliveryStatus || 'stored'}</p>
                  </div>
                ))}
                {!summary?.parentAlerts?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No parent alerts generated yet.</p> : null}
              </div>
            </div>

            <div className="card-panel p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Justification AI summary</p>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-500">
                  {(summary?.justificationSummary?.total || 0)} absence cases
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ['Genuine', summary?.justificationSummary?.genuine || 0, 'bg-emerald-500/10 text-emerald-500'],
                  ['Suspicious', summary?.justificationSummary?.suspicious || 0, 'bg-amber-500/10 text-amber-500'],
                  ['Fake', summary?.justificationSummary?.fake || 0, 'bg-rose-500/10 text-rose-500'],
                  ['Pending', summary?.justificationSummary?.pending || 0, 'bg-slate-500/10 text-slate-400'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-panel p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Absence reason intelligence</p>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-500">
                  {(summary?.justificationRecords?.length || 0)} reviewed
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {(summary?.justificationRecords || []).map((record) => (
                  <div key={`${record.id}-reason`} className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{record.student?.name || 'Unknown student'}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.date} · {record.time} · {record.absentReason || 'Absent record'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        record.justification?.aiLabel === 'genuine'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : record.justification?.aiLabel === 'fake'
                            ? 'bg-rose-500/10 text-rose-500'
                            : record.justification?.aiLabel === 'suspicious'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {record.justification?.aiLabel || 'pending'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Student reason</p>
                        <p className="mt-2">{record.justification?.reason || 'Reason not submitted yet.'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">AI summary</p>
                        <p className="mt-2">{record.justification?.aiSummary || 'Pending AI review.'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Trust signal</p>
                        <p className="mt-2">Honesty score {record.justification?.trustScore || record.student?.honestyScore || 80}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{record.justification?.patternNote || 'No pattern insight yet.'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!summary?.justificationRecords?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">Absent reasons will appear here after students submit them.</p> : null}
              </div>
            </div>

            <div className="card-panel p-5 xl:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Auto intervention system</p>
                <span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-500">
                  {summary?.interventionAnalytics?.total || 0} actions tracked
                </span>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <div className="rounded-[1.35rem] border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">System impact</p>
                      <p className="mt-3 text-4xl font-semibold">{summary?.stats?.interventionSuccessRate || 0}%</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-900">
                      {summary?.interventionAnalytics?.recent?.length || 0} recent updates
                    </span>
                  </div>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
                    Intervention success rate based on tracked actions and follow-up improvement trends across flagged students.
                  </p>
                  <div className="mt-5 rounded-[1.1rem] bg-slate-50 p-4 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recommended teacher workflow</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      Student par <span className="font-semibold text-cyan-500">AI Summary</span> kholo, suggested action run karo, aur progress yahin track karo.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {interventionCards.map(([actionKey, value]) => (
                    <div key={actionKey} className="flex min-h-[150px] flex-col justify-between rounded-[1.35rem] border border-slate-200 p-4 dark:border-slate-800">
                      <div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${interventionActionMeta[actionKey].tone}`}>
                          {interventionActionMeta[actionKey].label}
                        </span>
                        <p className="mt-5 text-3xl font-semibold">{value}</p>
                      </div>
                      <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
                        {value ? 'Tracked from completed teacher actions.' : 'No action logged yet.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="space-y-3">
                {(summary?.interventionAnalytics?.recent || []).map((item) => (
                  <div key={item.id} className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{item.studentName}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs ${interventionActionMeta[item.actionType]?.tone || 'bg-blue-500/10 text-blue-500'}`}>
                          {interventionActionMeta[item.actionType]?.label || item.actionType}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs ${
                          item.outcome === 'improved'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : item.outcome === 'pending'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {item.outcome}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.note || 'Teacher intervention logged without extra note.'}</p>
                  </div>
                ))}
                {!summary?.interventionAnalytics?.recent?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">Teacher actions will start appearing here after AI-guided interventions are used.</p> : null}
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 p-5 dark:border-slate-800">
                  <p className="text-sm font-semibold">What becomes functional here</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <p>1-click actions from the AI Summary panel instantly update this intervention tracker.</p>
                    <p>`Send Warning` and `Notify Parent` also create parent communication logs from the backend.</p>
                    <p>`Schedule Meeting`, `Extra Assignment`, and `Monitor` save follow-up actions for later review.</p>
                  </div>
                  <div className="mt-5 rounded-[1.1rem] bg-slate-50 p-4 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Live use</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      Students page me kisi bhi student par <span className="font-semibold text-cyan-500">AI Summary</span> click karo, phir recommended action run karo. Yeh section auto-refresh ho jayega.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'students' ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card-panel p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">Students</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Search, review, and remove student accounts.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="month"
                  className="field px-4 py-3"
                  value={reportMonth}
                  onChange={(event) => setReportMonth(event.target.value)}
                />
                <div className="field flex items-center gap-2 px-4 py-3">
                  <Search size={16} />
                  <input className="w-44 bg-transparent outline-none md:w-64" placeholder="Search students" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <button onClick={exportCsv} className="action-secondary"><Download size={16} />CSV</button>
                <button onClick={exportPdf} className="action-secondary"><Download size={16} />PDF</button>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Department</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Attendance %</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Security</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium leading-6">{student.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{student.email}</p>
                      </td>
                      <td className="px-4 py-4 align-middle">{student.department}</td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap">{student.attendancePercentage}%</td>
                      <td className="px-4 py-4 align-middle">
                        {records.some((record) => record.studentId === student.id && record.suspicious) ? (
                          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-500">Flagged</span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">Secure</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex flex-col items-start gap-2 xl:flex-row xl:flex-wrap xl:items-center">
                          <button onClick={() => openStudentSummary(student.id)} className="inline-flex whitespace-nowrap items-center gap-2 text-cyan-500">
                            <Sparkles size={15} />
                            {studentSummaryLoading === student.id ? 'Loading...' : 'AI Summary'}
                          </button>
                          <button onClick={() => deleteStudent(student.id)} className="whitespace-nowrap text-rose-500">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 p-5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">Absent correction panel</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">If the system marks a student absent by mistake, you can correct it to present from here.</p>
                </div>
                <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">{recentAbsentRecords.length} absent records</span>
              </div>
              <div className="mt-4 space-y-3">
                {recentAbsentRecords.map((record) => (
                  <div key={record.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{record.student?.name || 'Unknown student'}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.date} at {record.time} · {record.absentReason || 'Absent record'}</p>
                    </div>
                    <button
                      onClick={() => correctStudentAttendance(record.id)}
                      className="action-secondary"
                      disabled={correctingAttendanceId === record.id}
                    >
                      {correctingAttendanceId === record.id ? 'Correcting...' : 'Mark Present'}
                    </button>
                  </div>
                ))}
                {!recentAbsentRecords.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No absent student records are waiting for correction.</p> : null}
              </div>
            </div>

          </div>

          {selectedStudentSummary ? (
            <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/60 p-4 backdrop-blur-sm">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-cyan-500/20 bg-white p-5 shadow-2xl dark:bg-slate-950">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-500">
                      <Sparkles size={18} />
                      <p className="text-lg font-semibold">Auto student summary</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold">{selectedStudentSummary.student?.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedStudentSummary.student?.email} · {selectedStudentSummary.student?.department}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-950/60 px-3 py-1 text-xs text-white dark:bg-white/10">{selectedStudentSummary.mode} insight</span>
                    <span className={`rounded-full px-3 py-1 text-xs ${
                      selectedStudentSummary.intervention?.urgency === 'high'
                        ? 'bg-rose-500/10 text-rose-500'
                        : selectedStudentSummary.intervention?.urgency === 'medium'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {selectedStudentSummary.intervention?.urgency} urgency
                    </span>
                    <button onClick={() => setSelectedStudentSummary(null)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-slate-800">
                      <X size={14} />
                      Close
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">{selectedStudentSummary.report}</p>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Attendance</p>
                    <p className="mt-3 text-2xl font-semibold">{selectedStudentSummary.context?.attendancePercentage || 0}%</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Frequent absence</p>
                    <p className="mt-3 text-lg font-semibold">{selectedStudentSummary.context?.frequentAbsentDay?.day || 'No pattern'}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Afternoon engagement</p>
                    <p className="mt-3 text-2xl font-semibold">{selectedStudentSummary.context?.afternoonEngagement || 0}%</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Honesty score</p>
                    <p className="mt-3 text-2xl font-semibold">{selectedStudentSummary.context?.honestyScore || 80}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Suspicious flags</p>
                    <p className="mt-3 text-2xl font-semibold">{selectedStudentSummary.context?.suspiciousCount || 0}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={18} className="text-amber-500" />
                    <p className="font-semibold">Recommended action</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{selectedStudentSummary.intervention?.summary}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{selectedStudentSummary.intervention?.successHint}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {[
                      ['send-warning', 'Send Warning', Send],
                      ['notify-parent', 'Notify Parent', Users],
                      ['schedule-meeting', 'Schedule Meeting', CalendarDays],
                      ['extra-assignment', 'Extra Assignment', Download],
                      ['monitor', 'Mark Monitor', ShieldAlert],
                    ]
                      .filter(([action]) => selectedStudentSummary.intervention?.actions?.includes(action))
                      .map(([action, label, Icon]) => (
                        <button
                          key={action}
                          onClick={() => triggerStudentAction(action)}
                          className="action-secondary"
                          disabled={studentActionLoading === action}
                        >
                          <Icon size={16} />
                          {studentActionLoading === action ? 'Working...' : label}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Risk signals</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(selectedStudentSummary.context?.riskSignals || {})
                        .filter(([, active]) => active)
                        .map(([key]) => (
                          <span key={key} className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </span>
                        ))}
                      {!Object.values(selectedStudentSummary.context?.riskSignals || {}).some(Boolean) ? (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-500">No critical risk detected</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recent interventions</p>
                    <div className="mt-3 space-y-2">
                      {(selectedStudentSummary.context?.recentInterventions || []).map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-[1rem] bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900">
                          <span>{item.actionType}</span>
                          <span className="text-slate-500 dark:text-slate-400">{item.outcome}</span>
                        </div>
                      ))}
                      {!selectedStudentSummary.context?.recentInterventions?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No previous intervention history yet.</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={createStudent} className="card-panel space-y-4 p-5">
            <p className="text-lg font-semibold">Add student</p>
            <input className="field" placeholder="Full name" value={newStudent.name} onChange={(event) => setNewStudent({ ...newStudent, name: event.target.value })} required />
            <input className="field" placeholder="Email address" type="email" value={newStudent.email} onChange={(event) => setNewStudent({ ...newStudent, email: event.target.value })} required />
            <input className="field" placeholder="Temporary password" value={newStudent.password} onChange={(event) => setNewStudent({ ...newStudent, password: event.target.value })} required />
            <input className="field" placeholder="Department" value={newStudent.department} onChange={(event) => setNewStudent({ ...newStudent, department: event.target.value })} />
            <input className="field" placeholder="Parent name" value={newStudent.parentName} onChange={(event) => setNewStudent({ ...newStudent, parentName: event.target.value })} />
            <input className="field" placeholder="Parent email" type="email" value={newStudent.parentEmail} onChange={(event) => setNewStudent({ ...newStudent, parentEmail: event.target.value })} />
            <input className="field" placeholder="Parent phone" value={newStudent.parentPhone} onChange={(event) => setNewStudent({ ...newStudent, parentPhone: event.target.value })} />
            <FaceCapture onFramesChange={setFaceImages} maxFrames={5} label="Student face dataset" />
            <button className="action-primary w-full justify-center">Add student to dataset</button>
          </form>
        </div>
      ) : null}

      {currentPage === 'checkin' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="card-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">Teacher check-in console</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Face + location + time verification ke saath apni attendance mark karo.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs ${teacherProfile?.faceRegistered ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {teacherProfile?.faceRegistered ? 'Face ready' : 'Face setup pending'}
                </span>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-500">Geo-fence enabled</span>
              </div>
            </div>

            {!teacherProfile?.faceRegistered ? (
              <div className="mt-5 space-y-4">
                <FaceCapture onFramesChange={setTeacherFaceImages} maxFrames={6} label="Teacher face registration" />
                <button onClick={registerTeacherFace} className="action-primary" disabled={teacherFaceSaving}>
                  <UserCheck size={16} />
                  {teacherFaceSaving ? 'Registering...' : 'Register teacher face'}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-slate-950">
                  <video ref={videoRef} className="h-80 w-full object-cover" playsInline muted />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={startScan} className="action-primary">Start camera</button>
                  <button onClick={markTeacherAttendance} className="action-secondary">
                    <UserCheck size={16} />
                    Check-In
                  </button>
                  <button onClick={stopScan} className="action-secondary">
                    <Square size={16} />
                    Stop
                  </button>
                </div>
              </>
            )}

            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{teacherScanStatus}</p>
            {teacherScanError ? <p className="mt-2 text-sm text-rose-500">{teacherScanError}</p> : null}
          </div>

          <div className="space-y-6">
            <form onSubmit={saveCalendarDay} className="card-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">No class and holiday control</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use this when there is no class, a holiday, or a special event day. Students will not be marked absent on holiday and no-class dates.</p>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-500">{calendarEvents.length} calendar days</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  type="date"
                  className="field"
                  value={calendarForm.date}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
                <select
                  className="field"
                  value={calendarForm.type}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, type: event.target.value }))}
                >
                  <option value="no-class">No class</option>
                  <option value="holiday">Holiday</option>
                  <option value="event">Event</option>
                  <option value="exam">Exam</option>
                </select>
                <input
                  className="field md:col-span-2"
                  placeholder="Title, for example Sports Day or Staff Event"
                  value={calendarForm.title}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
                <input
                  className="field md:col-span-2"
                  placeholder="Optional time"
                  value={calendarForm.time}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, time: event.target.value }))}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="action-primary" type="submit">
                  <CalendarDays size={16} />
                  Save calendar day
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sunday and fixed holidays are already skipped automatically.</p>
              </div>
              <div className="mt-4 space-y-2">
                {calendarEvents.slice(0, 6).map((item) => (
                  <div key={`${item.date}-${item.title}`} className="flex items-center justify-between rounded-[1rem] border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.date}{item.time ? ` · ${item.time}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${item.type === 'holiday' || item.type === 'no-class' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>
            </form>

            <div className="card-panel p-5">
              <p className="text-lg font-semibold">Today status</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Last check-in</p>
                  <p className="mt-3 text-xl font-semibold">{teacherLatest ? `${teacherLatest.date} ${teacherLatest.time}` : 'Not marked yet'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Remark</p>
                  <p className={`mt-3 text-xl font-semibold ${teacherLatest?.late ? 'text-amber-500' : ''}`}>{teacherLatest?.remark || 'Pending'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Face confidence</p>
                  <p className="mt-3 text-xl font-semibold">{teacherLatest?.faceConfidence ? `${teacherLatest.faceConfidence}%` : 'Pending'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Location</p>
                  <p className="mt-3 inline-flex items-center gap-2 text-xl font-semibold"><MapPin size={16} />{teacherLatest?.location || 'Campus required'}</p>
                </div>
              </div>
            </div>

            <div className="card-panel p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Attendance history</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{teacherRecords.length} records</span>
              </div>
              <div className="mt-4 space-y-3">
                {teacherRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{record.date} at {record.time}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.locationLabel || 'Teacher Check-In Console'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-500">{record.status}</span>
                        <span className={`rounded-full px-3 py-1 text-xs ${record.late ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>{record.remark}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {!teacherRecords.length ? <p className="text-sm text-slate-500 dark:text-slate-400">Teacher attendance abhi mark nahi hui hai.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'attendance' ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="card-panel p-5">
            <p className="text-lg font-semibold">Live attendance scanner</p>
            <div className="mt-4 overflow-hidden rounded-[1.5rem] bg-slate-950">
              <video ref={videoRef} className="h-72 w-full object-cover" playsInline muted />
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={startScan} className="action-primary">Start camera</button>
              <button onClick={markAttendance} className="action-secondary">Mark attendance</button>
              <button onClick={stopScan} className="action-secondary"><Square size={16} />Stop</button>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{scanStatus}</p>
            {captureError ? <p className="mt-2 text-sm text-rose-500">{captureError}</p> : null}
          </div>

          <div className="card-panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Suspicious entries</p>
              <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">
                {(records.filter((record) => record.suspicious)).length} alerts
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {records.filter((record) => record.suspicious).slice(0, 6).map((record) => (
                <div key={record.id} className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50/90 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{record.student?.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{record.locationLabel || 'Unknown location'} · {record.date} {record.time}</p>
                    </div>
                    <span className="rounded-full bg-slate-700/70 px-3 py-1 text-xs text-white dark:bg-slate-950/40 dark:text-rose-200">{record.suspiciousScore || 0}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-rose-700 dark:text-rose-200">
                    {(record.suspiciousFlags || []).map((flag) => (
                      <p key={flag.code}>[{flag.label}] {flag.detail}</p>
                    ))}
                  </div>
                </div>
              ))}
              {!records.filter((record) => record.suspicious).length ? <p className="text-sm text-slate-500 dark:text-slate-400">No suspicious attendance alerts yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'assistant' ? <AIChatAssistant role="teacher" /> : null}
    </DashboardLayout>
  )
}
