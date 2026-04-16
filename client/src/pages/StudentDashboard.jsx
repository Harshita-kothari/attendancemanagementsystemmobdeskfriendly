import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  Camera,
  Clock3,
  Download,
  Eye,
  LayoutDashboard,
  MessageSquareMore,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Shield,
  Square,
  TrendingUp,
  UserCircle2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSunday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { toast } from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../lib/api'
import { AIChatAssistant } from '../components/AIChatAssistant'
import { DashboardLayout } from '../components/DashboardLayout'
import { FaceCapture } from '../components/FaceCapture'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const sidebar = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/student/calendar', label: 'Calendar', icon: BookOpenCheck },
  { to: '/student/history', label: 'Attendance History', icon: CalendarDays },
  { to: '/student/proofs', label: 'Attendance Proof', icon: Shield },
  { to: '/student/downloads', label: 'Download Attendance', icon: Download },
  { to: '/student/assistant', label: 'AI Assistant', icon: MessageSquareMore },
  { to: '/student/profile', label: 'Profile', icon: UserCircle2 },
  { to: '/student/scan', label: 'Live Check-in', icon: ScanFace },
]

const HOLIDAY_DEFINITIONS = [
  { monthDay: '01-26', title: 'Republic Day', type: 'holiday' },
  { monthDay: '08-15', title: 'Independence Day', type: 'holiday' },
  { monthDay: '10-02', title: 'Gandhi Jayanti', type: 'holiday' },
  { monthDay: '12-25', title: 'Christmas', type: 'holiday' },
]

const EXAM_DEFINITIONS = [
  { date: '2026-04-18', title: 'Unit Test - Mathematics', type: 'exam', time: '11:00 am' },
  { date: '2026-04-24', title: 'Practical Assessment', type: 'exam', time: '09:30 am' },
]

export function StudentDashboard() {
  const location = useLocation()
  const { user } = useAuth()
  const { alertsEnabled } = useTheme()
  const [student, setStudent] = useState(null)
  const [records, setRecords] = useState([])
  const [latestScanRecord, setLatestScanRecord] = useState(null)
  const [scanStatus, setScanStatus] = useState('Camera not started')
  const [scanError, setScanError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [engagementToday, setEngagementToday] = useState(0)
  const [geoZone, setGeoZone] = useState(null)
  const [geoInfo, setGeoInfo] = useState(null)
  const [attendanceOtpChallengeId, setAttendanceOtpChallengeId] = useState('')
  const [attendanceOtpCode, setAttendanceOtpCode] = useState('')
  const [attendanceOtpStatus, setAttendanceOtpStatus] = useState('')
  const [faceRegistrationFrames, setFaceRegistrationFrames] = useState([])
  const [registeringFace, setRegisteringFace] = useState(false)
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date())
  const [proofModalRecord, setProofModalRecord] = useState(null)
  const [absenceReasonDrafts, setAbsenceReasonDrafts] = useState({})
  const [absenceProofDrafts, setAbsenceProofDrafts] = useState({})
  const [submittingJustificationId, setSubmittingJustificationId] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))

  useEffect(() => {
    loadProfile()
    requestNotificationPermission()
    return () => stopCamera()
  }, [])

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // Ignore permission errors; toast/sound still work.
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
    const frequencies =
      type === 'success'
        ? [660, 880, 1040]
        : [280, 220, 180]

    gainNode.gain.setValueAtTime(0.0001, now)
    frequencies.forEach((frequency, index) => {
      const point = now + index * 0.12
      oscillator.frequency.setValueAtTime(frequency, point)
      gainNode.gain.exponentialRampToValueAtTime(0.12, point + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, point + 0.1)
    })

    oscillator.type = type === 'success' ? 'sine' : 'triangle'
    oscillator.start(now)
    oscillator.stop(now + frequencies.length * 0.12 + 0.12)
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

  function normalizeRecord(record) {
    if (!record) return null
    return {
      ...record,
      confidence: typeof record.confidence === 'number' ? record.confidence : 0,
      engagementScore: typeof record.engagementScore === 'number' ? record.engagementScore : 0,
      emotionState: record.emotionState || 'attentive',
      suspiciousFlags: Array.isArray(record.suspiciousFlags) ? record.suspiciousFlags : [],
      proofImage: record.proofImage || null,
      proofCapturedAt: record.proofCapturedAt || record.createdAt || null,
      justification: record.justification || null,
    }
  }

  function updateReasonDraft(recordId, value) {
    setAbsenceReasonDrafts((current) => ({ ...current, [recordId]: value }))
  }

  function updateProofDraft(recordId, value) {
    setAbsenceProofDrafts((current) => ({ ...current, [recordId]: value }))
  }

  async function submitAbsenceReason(record) {
    const reason = String(absenceReasonDrafts[record.id] || '').trim()
    const proofNote = String(absenceProofDrafts[record.id] || '').trim()

    if (reason.length < 5) {
      const message = 'Please describe the absence reason more clearly so the AI review can be useful.'
      setScanError(message)
      if (alertsEnabled) toast.error(message)
      return
    }

    try {
      setSubmittingJustificationId(record.id)
      const { data } = await api.post(`/api/attendance/${record.id}/justify`, {
        reason,
        proofNote,
      })

      setLatestScanRecord(normalizeRecord(data.record))
      setAttendanceOtpStatus(data.message || 'Absence reason analyzed.')
      setAbsenceReasonDrafts((current) => ({ ...current, [record.id]: '' }))
      setAbsenceProofDrafts((current) => ({ ...current, [record.id]: '' }))
      await loadProfile()
      if (alertsEnabled) {
        toast.success(data.message || 'Absence reason analyzed successfully.')
      }
    } catch (error) {
      const message = error.response?.data?.message || 'The absence reason could not be analyzed.'
      setScanError(message)
      if (alertsEnabled) toast.error(message)
    } finally {
      setSubmittingJustificationId('')
    }
  }

  function downloadProof(record) {
    if (!record?.proofImage) return
    const link = document.createElement('a')
    link.href = record.proofImage
    link.download = `attendance-proof-${record.date || 'record'}-${record.time?.replace(/:/g, '-') || 'time'}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function loadProfile() {
    try {
      const [profileRes, zoneRes] = await Promise.all([
        api.get('/api/students/me/profile'),
        api.get('/api/system/geo-fence'),
      ])
      const { data } = profileRes
      setStudent(data.student || user || null)
      const normalizedRecords = (data.records || []).map(normalizeRecord)
      setRecords(normalizedRecords)
      setLatestScanRecord(normalizedRecords[0] || null)
      setEngagementToday(data.engagementToday || 0)
      setGeoZone(zoneRes.data.zone)
    } catch (error) {
      setStudent(user || null)
      setScanError(error.response?.data?.message || 'Unable to load student profile.')
    }
  }

  async function registerStudentFace() {
    if (faceRegistrationFrames.length < 5) {
      const message = 'Capture at least 5 face samples to complete student face registration.'
      setScanError(message)
      if (alertsEnabled) toast.error(message)
      return
    }

    try {
      setRegisteringFace(true)
      setScanError('')
      const { data } = await api.post('/api/students/me/register-face', {
        faceImages: faceRegistrationFrames,
      })
      setStudent(data.student || student)
      setFaceRegistrationFrames([])
      setAttendanceOtpStatus(data.message || 'Face profile registered successfully.')
      await loadProfile()
      if (alertsEnabled) toast.success(data.message || 'Face profile registered successfully.')
    } catch (error) {
      const message = error.response?.data?.ownerEmail
        ? `${error.response?.data?.message || 'Unable to register face profile.'} Existing owner: ${error.response.data.ownerEmail}`
        : error.response?.data?.detail
          ? `${error.response?.data?.message || 'Unable to register face profile.'} ${error.response.data.detail}`
          : error.response?.data?.message || 'Unable to register face profile.'
      setScanError(message)
      if (alertsEnabled) toast.error(message)
    } finally {
      setRegisteringFace(false)
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
            accuracyMeters: Number(position.coords.accuracy?.toFixed(0) || 0),
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      )
    })
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
      setScanStatus('Camera active. Ready for live check-in.')
      setScanError('')
    } catch {
      setScanError('Allow camera access to use live face check-in.')
    }
  }

  async function sendAttendanceOtp() {
    try {
      setScanError('')
      setAttendanceOtpStatus('Sending OTP to your registered email...')
      const { data } = await api.post('/api/attendance/request-otp')
      setAttendanceOtpChallengeId(data.challengeId || '')
      setAttendanceOtpStatus(data.message || 'Attendance OTP sent to your email.')
      if (alertsEnabled) {
        toast.success(data.message || 'Attendance OTP sent.')
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Attendance OTP send failed.'
      setAttendanceOtpStatus('')
      setScanError(message)
      if (alertsEnabled) {
        toast.error(message)
      }
    }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }

  async function markLiveAttendance() {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      setScanError('The camera is not ready yet. Start the camera first.')
      return
    }
    if (!attendanceOtpChallengeId) {
      setScanError('Send the OTP first, then verify the code before marking attendance.')
      return
    }
    if (attendanceOtpCode.trim().length !== 6) {
      setScanError('Enter a 6-digit OTP to mark attendance.')
      return
    }

    setScanning(true)
    setScanError('')
    try {
      const canvas = canvasRef.current
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
      const image = canvas.toDataURL('image/jpeg', 0.85)
      const gps = await getGpsLocation()
      setGeoInfo(gps)
      const { data } = await api.post('/api/attendance/scan', {
        image,
        locationLabel: 'Student Live Check-in',
        gps,
        otpChallengeId: attendanceOtpChallengeId,
        otpCode: attendanceOtpCode,
      })

      setLatestScanRecord(normalizeRecord(data.record))
      setGeoInfo(data.geoFence || null)
      setScanStatus(`${data.notification}`)
      setAttendanceOtpChallengeId('')
      setAttendanceOtpCode('')
      setAttendanceOtpStatus('Attendance OTP verified successfully.')
      if (alertsEnabled) {
        playAttendanceTone('success')
        toast.success(data.notification)
        showBrowserNotification('Attendance marked', data.notification)
      }
      await loadProfile()
    } catch (error) {
      const message = error.response?.data?.message || 'Live check-in failed.'
      setScanError(message)
      if (error.response?.data?.geoFence) {
        setGeoInfo(error.response.data.geoFence)
      }
      if (error.response?.data?.record) {
        setLatestScanRecord(normalizeRecord(error.response.data.record))
        setScanStatus(error.response.data.record.status === 'absent' ? 'Attendance marked absent for this attempt.' : 'Scan processed.')
        await loadProfile()
      }
      if (alertsEnabled) {
        playAttendanceTone('error')
        toast.error(message)
        showBrowserNotification('Attendance alert', message)
      }
    } finally {
      setScanning(false)
    }
  }

  async function downloadMonthlyReport() {
    const { data } = await api.get('/api/attendance', {
      params: {
        month: reportMonth,
        studentId: student?.id,
      },
    })

    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Monthly Attendance Report', 14, 18)
    doc.setFontSize(11)
    doc.text(`Student: ${student?.name || '-'}`, 14, 28)
    doc.text(`Month: ${reportMonth}`, 14, 35)
    doc.text(`Attendance: ${student?.attendancePercentage || 0}%`, 14, 42)

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Time', 'Status', 'Confidence', 'Engagement', 'Reason AI', 'Security']],
      body: data.records.map((record) => [
        record.date,
        record.time,
        record.status,
        `${Math.round((record.confidence || 0) * 100)}%`,
        `${record.engagementScore || 0}% ${record.emotionState || 'attentive'}`,
        record.justification?.aiLabel ? `${record.justification.aiLabel} · ${record.justification.trustScore || 0}` : (record.status === 'absent' ? 'Pending' : '-'),
        record.suspicious ? 'Suspicious' : 'Clean',
      ]),
    })

    doc.save(`student-monthly-report-${reportMonth}.pdf`)
  }

  async function downloadAttendanceHistoryPdf() {
    const sourceRecords = records.length
      ? records
      : (
          await api.get('/api/attendance', {
            params: {
              studentId: student?.id,
            },
          })
        ).data.records.map(normalizeRecord)

    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Attendance History Report', 14, 18)
    doc.setFontSize(11)
    doc.text(`Student: ${student?.name || user?.name || '-'}`, 14, 28)
    doc.text(`Student code: ${student?.studentCode || '-'}`, 14, 35)
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 42)
    doc.text(`Total records: ${sourceRecords.length}`, 14, 49)

    autoTable(doc, {
      startY: 57,
      head: [['Date', 'Time', 'Status', 'Confidence', 'Engagement', 'Reason AI', 'Security']],
      body: sourceRecords.map((record) => [
        record.date,
        record.time,
        record.status,
        `${Math.round((record.confidence || 0) * 100)}%`,
        `${record.engagementScore || 0}% · ${record.emotionState || 'attentive'}`,
        record.justification?.aiLabel ? `${record.justification.aiLabel} · ${record.justification.trustScore || 0}` : (record.status === 'absent' ? 'Pending' : '-'),
        record.suspicious ? 'Suspicious' : 'Clean',
      ]),
    })

    doc.save(`attendance-history-${student?.studentCode || 'student'}.pdf`)
  }

  const trend = records.slice(0, 10).reverse().map((record, index) => ({
    label: record.date || `Day ${index + 1}`,
    confidence: Math.round((record.confidence || 0) * 100),
  }))

  const engagementTrend = records.slice(0, 7).reverse().map((record, index) => ({
    label: record.date || `Day ${index + 1}`,
    score: record.engagementScore || 0,
  }))

  const weeklyOverview = Array.from({ length: 7 }, (_, index) => {
    const record = records[index]
    return {
      label: record?.date ? record.date.slice(5) : `D${7 - index}`,
      score: record ? Math.max(35, Math.round((record.confidence || 0) * 100)) : 0,
      active: Boolean(record),
    }
  }).reverse()

  const totalRecords = records.length
  const recentRecord = latestScanRecord || records[0] || null
  const activeAbsentRecord = latestScanRecord?.status === 'absent' ? latestScanRecord : null
  const averageConfidence = totalRecords
    ? Math.round(records.reduce((sum, record) => sum + Math.round((record.confidence || 0) * 100), 0) / totalRecords)
    : 0

  const streak = records.reduce(
    (count, record, index, list) => {
      if (index === 0) return record ? 1 : 0
      const current = new Date(record.date)
      const prev = new Date(list[index - 1].date)
      const diff = Math.round((prev - current) / (1000 * 60 * 60 * 24))
      return diff === 1 ? count + 1 : count
    },
    0,
  )

  const summaryCards = [
    {
      label: 'Attendance rate',
      value: `${student?.attendancePercentage || 0}%`,
      hint: 'Updated from your live face check-ins.',
      icon: TrendingUp,
    },
    {
      label: 'Verified scans',
      value: totalRecords,
      hint: 'Successful attendance entries stored.',
      icon: BadgeCheck,
    },
    {
      label: 'Avg confidence',
      value: `${averageConfidence}%`,
      hint: 'Recognition confidence across recent scans.',
      icon: ShieldCheck,
    },
    {
      label: 'Streak',
      value: `${streak} day${streak === 1 ? '' : 's'}`,
      hint: 'Continuous attendance momentum.',
      icon: Activity,
    },
    {
      label: 'Engagement today',
      value: `${engagementToday}%`,
      hint: 'Smart Classroom AI engagement score.',
      icon: ScanFace,
    },
    {
      label: 'Honesty score',
      value: `${student?.honestyScore ?? 80}`,
      hint: 'AI absence-reason trust score for your profile.',
      icon: ShieldCheck,
    },
  ]

  const pendingAbsentRecords = records.filter((record) => record.status === 'absent' && !record.justification)

  const currentPage = location.pathname.endsWith('/history')
    ? 'history'
    : location.pathname.endsWith('/calendar')
      ? 'calendar'
      : location.pathname.endsWith('/proofs')
        ? 'proofs'
      : location.pathname.endsWith('/downloads')
        ? 'downloads'
      : location.pathname.endsWith('/assistant')
        ? 'assistant'
    : location.pathname.endsWith('/profile')
      ? 'profile'
      : location.pathname.endsWith('/scan')
        ? 'scan'
        : 'dashboard'

  const pageMeta = {
    dashboard: {
      title: 'Student Dashboard',
      subtitle: 'Track personal attendance, review history, and stay on top of attendance percentage.',
    },
    calendar: {
      title: 'Smart Academic Calendar',
      subtitle: 'Track attendance, holidays, and events from one clean academic calendar.',
    },
    history: {
      title: 'Attendance History',
      subtitle: 'Review your recorded attendance entries with date, time, and confidence.',
    },
    proofs: {
      title: 'Attendance Proof',
      subtitle: 'Review saved attendance snapshots with date, time, location, and download access.',
    },
    downloads: {
      title: 'Download Attendance',
      subtitle: 'Export your attendance reports in a clean PDF format with one click.',
    },
    assistant: {
      title: 'AI Chatbot Assistant',
      subtitle: 'Ask attendance questions and get smart answers based on your dashboard data.',
    },
    profile: {
      title: 'Student Profile',
      subtitle: 'See your registered identity, department, and face-registration status.',
    },
    scan: {
      title: 'Live Check-in',
      subtitle: 'Scan your live face and mark attendance instantly with the current time.',
    },
  }

  function getHolidayForDate(date) {
    const monthDay = format(date, 'MM-dd')
    const exactHoliday = HOLIDAY_DEFINITIONS.find((holiday) => holiday.monthDay === monthDay)
    if (exactHoliday) return exactHoliday
    if (isSunday(date)) {
      return { title: 'Sunday Holiday', type: 'holiday' }
    }
    return null
  }

  function getExamForDate(date) {
    const isoDate = format(date, 'yyyy-MM-dd')
    return EXAM_DEFINITIONS.find((exam) => exam.date === isoDate) || null
  }

  function getAttendanceRecordForDate(date) {
    const isoDate = format(date, 'yyyy-MM-dd')
    return records.find((record) => record.date === isoDate) || null
  }

  function getCalendarMeta(date) {
    const attendanceRecord = getAttendanceRecordForDate(date)
    const holiday = getHolidayForDate(date)
    const exam = getExamForDate(date)

    if (attendanceRecord?.status === 'present') {
      return {
        tone: 'present',
        label: 'Present',
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-500/10 text-emerald-500',
        detail: `${attendanceRecord.time} · ${Math.round((attendanceRecord.confidence || 0) * 100)}% confidence`,
      }
    }

    if (attendanceRecord?.status === 'absent') {
      return {
        tone: 'absent',
        label: 'Absent',
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-500/10 text-rose-500',
        detail: attendanceRecord.absentReason || 'Attendance was not accepted for this date.',
      }
    }

    if (exam) {
      return {
        tone: 'exam',
        label: 'Exam',
        dotClass: 'bg-violet-500',
        badgeClass: 'bg-violet-500/10 text-violet-500',
        detail: `${exam.title}${exam.time ? ` · ${exam.time}` : ''}`,
      }
    }

    if (holiday) {
      return {
        tone: 'holiday',
        label: 'Holiday',
        dotClass: 'bg-sky-500',
        badgeClass: 'bg-sky-500/10 text-sky-500',
        detail: holiday.title,
      }
    }

    return {
      tone: 'none',
      label: 'No event',
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-500/10 text-slate-500',
      detail: 'No attendance, holiday, or event recorded.',
    }
  }

  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  })
  const selectedDateRecord = getAttendanceRecordForDate(selectedCalendarDate)
  const selectedDateHoliday = getHolidayForDate(selectedCalendarDate)
  const selectedDateExam = getExamForDate(selectedCalendarDate)
  const selectedDateMeta = getCalendarMeta(selectedCalendarDate)
  const monthRecords = records.filter((record) => record.date?.startsWith(format(calendarMonth, 'yyyy-MM')))
  const monthPresentCount = monthRecords.filter((record) => record.status === 'present').length
  const monthAbsentCount = monthRecords.filter((record) => record.status === 'absent').length
  const monthAttendanceRate = monthRecords.length ? Math.round((monthPresentCount / monthRecords.length) * 100) : 0
  const monthHolidayCount = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter((date) => Boolean(getHolidayForDate(date))).length
  const monthExamCount = EXAM_DEFINITIONS.filter((exam) => exam.date.startsWith(format(calendarMonth, 'yyyy-MM'))).length
  const upcomingHolidayDate = eachDayOfInterval({ start: new Date(), end: addDays(new Date(), 45) }).find((date) => Boolean(getHolidayForDate(date)))
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const upcomingHolidayStart = upcomingHolidayDate ? new Date(upcomingHolidayDate) : null
  if (upcomingHolidayStart) upcomingHolidayStart.setHours(0, 0, 0, 0)
  const upcomingHolidayDays = upcomingHolidayStart
    ? Math.max(0, Math.ceil((upcomingHolidayStart - todayStart) / (1000 * 60 * 60 * 24)))
    : null
  const upcomingHolidayText = upcomingHolidayDate
    ? `Next holiday in ${upcomingHolidayDays} day${upcomingHolidayDays === 1 ? '' : 's'}`
    : 'No upcoming holiday detected'

  return (
    <DashboardLayout
      sidebar={sidebar}
      title={pageMeta[currentPage].title}
      subtitle={pageMeta[currentPage].subtitle}
    >
      {currentPage === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="card-panel p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                    <span className="rounded-full bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <Icon size={16} />
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.hint}</p>
                </div>
              )
            })}
          </div>

          <div className="card-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">Smart Classroom AI</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Your engagement today: {engagementToday}% {recentRecord?.emotionState ? `· ${recentRecord.emotionState}` : ''}
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-medium ${
                engagementToday >= 72
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : engagementToday >= 48
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-rose-500/10 text-rose-500'
              }`}>
                {engagementToday >= 72 ? 'Attentive' : engagementToday >= 48 ? 'Bored' : 'Sleepy'}
              </span>
            </div>
          </div>

          <div className="card-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">Geo-Fenced Smart Attendance</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Authorized zone: {geoZone?.name || 'Campus zone loading...'}
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-medium ${
                geoInfo?.allowed === false
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                {geoInfo?.allowed === false ? 'Out of range' : 'Zone active'}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Campus radius</p>
                <p className="mt-2 text-sm font-medium">{geoZone?.radiusMeters || 100} meters</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Distance</p>
                <p className="mt-2 text-sm font-medium">
                  {typeof geoInfo?.distanceMeters === 'number' ? `${geoInfo.distanceMeters} m` : 'Will check on scan'}
                </p>
                {typeof geoInfo?.accuracyMeters === 'number' ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">GPS accuracy: {geoInfo.accuracyMeters} m</p>
                ) : null}
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Rule</p>
                <p className="mt-2 text-sm font-medium">
                  Face + campus location both required
                  {typeof geoInfo?.effectiveRadiusMeters === 'number' ? ` (${geoInfo.effectiveRadiusMeters} m effective radius)` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-6">
              <div className="card-panel overflow-hidden p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-cyan-500/70">Student status</p>
                    <p className="mt-3 text-4xl font-semibold">{student?.attendancePercentage || 0}%</p>
                    <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                      Your attendance engine is active. Keep your confidence and streak healthy with daily live check-ins.
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Latest status</p>
                    <p className="mt-2 text-sm font-medium text-emerald-500">{recentRecord ? 'Attendance secured' : 'Awaiting first scan'}</p>
                  </div>
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 transition-all"
                    style={{ width: `${Math.max(8, student?.attendancePercentage || 0)}%` }}
                  />
                </div>
              </div>

              <div className="card-panel p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">Profile Snapshot</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                    {student?.faceRegistered ? 'Face verified' : 'Face pending'}
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <p><span className="text-slate-500 dark:text-slate-400">Name:</span> {student?.name}</p>
                  <p><span className="text-slate-500 dark:text-slate-400">Email:</span> {student?.email}</p>
                  <p><span className="text-slate-500 dark:text-slate-400">Department:</span> {student?.department}</p>
                  <p><span className="text-slate-500 dark:text-slate-400">Student code:</span> {student?.studentCode}</p>
                  <p><span className="text-slate-500 dark:text-slate-400">Registered face:</span> {student?.faceRegistered ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="card-panel p-6">
                <p className="text-lg font-semibold">Quick status</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock size={16} />
                      Last mark
                    </div>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{recentRecord ? `${recentRecord.date} at ${recentRecord.time}` : 'No attendance yet'}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock3 size={16} />
                      Readiness
                    </div>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{student?.faceRegistered ? 'Live scan ready for instant marking.' : 'Register face samples for reliable recognition.'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card-panel h-80 p-6">
                <p className="text-lg font-semibold">Confidence trend</p>
                <div className="mt-4 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="confidence" stroke="#0ea5e9" fill="rgba(14,165,233,0.25)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card-panel h-80 p-6">
                <p className="text-lg font-semibold">Engagement trend</p>
                <div className="mt-4 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={engagementTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="score" stroke="#22c55e" fill="rgba(34,197,94,0.22)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card-panel h-80 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">Weekly scan rhythm</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Last 7 entries</span>
                </div>
                <div className="mt-4 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyOverview}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="score" radius={[10, 10, 0, 0]}>
                        {weeklyOverview.map((item) => (
                          <Cell key={item.label} fill={item.active ? '#22c55e' : '#334155'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card-panel p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">Recent activity</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Live attendance feed</span>
                </div>
                <div className="mt-4 space-y-3">
                  {records.slice(0, 4).map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-[1.25rem] border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-medium capitalize">{record.status} marked</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{record.date} at {record.time}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Engagement: {record.engagementScore || 0}% · {record.emotionState || 'attentive'}
                        </p>
                        {record.suspicious ? <p className="mt-1 text-xs font-medium text-rose-500">Suspicious attendance detected</p> : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                        {Math.round((record.confidence || 0) * 100)}%
                      </span>
                    </div>
                  ))}
                  {!records.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No recent attendance activity available yet.</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'calendar' ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="card-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">Academic Calendar</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Attendance, holidays, and events in one monthly view.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCalendarMonth((value) => subMonths(value, 1))} className="action-secondary">Previous</button>
                  <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium dark:border-slate-800">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </div>
                  <button onClick={() => setCalendarMonth((value) => addMonths(value, 1))} className="action-secondary">Next</button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((date) => {
                  const meta = getCalendarMeta(date)
                  const isSelected = isSameDay(date, selectedCalendarDate)
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => setSelectedCalendarDate(date)}
                      className={`min-h-28 rounded-[1.5rem] border p-3 text-left transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                      } ${!isSameMonth(date, calendarMonth) ? 'opacity-45' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{format(date, 'd')}</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                      </div>
                      <p className="mt-3 text-xs font-medium">{meta.label}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">{meta.detail}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="card-panel p-6">
                <p className="text-lg font-semibold">This month</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Attendance</p>
                    <p className="mt-2 text-3xl font-semibold">{monthAttendanceRate}%</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{monthPresentCount} present · {monthAbsentCount} absent</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Academic events</p>
                    <p className="mt-2 text-3xl font-semibold">{monthHolidayCount + monthExamCount}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{monthHolidayCount} holidays · {monthExamCount} events</p>
                  </div>
                </div>
              </div>

              <div className="card-panel p-6">
                <p className="text-lg font-semibold">Upcoming highlight</p>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{upcomingHolidayText}</p>
                <div className="mt-4 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-sm font-medium">{upcomingHolidayDate ? format(upcomingHolidayDate, 'dd MMMM yyyy') : 'No holiday scheduled'}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{upcomingHolidayDate ? getHolidayForDate(upcomingHolidayDate)?.title : 'Calendar will update automatically.'}</p>
                </div>
              </div>

              <div className="card-panel p-6">
                <p className="text-lg font-semibold">Legend</p>
                <div className="mt-4 grid gap-3">
                  {[
                    ['Present', 'bg-emerald-500'],
                    ['Absent', 'bg-rose-500'],
                    ['Holiday', 'bg-sky-500'],
                    ['Event / Exam', 'bg-violet-500'],
                  ].map(([label, dotClass]) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className={`h-3 w-3 rounded-full ${dotClass}`} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">Selected date details</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{format(selectedCalendarDate, 'EEEE, dd MMMM yyyy')}</p>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-medium ${selectedDateMeta.badgeClass}`}>
                {selectedDateMeta.label}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Status</p>
                <p className="mt-2 text-sm font-medium">{selectedDateRecord?.status || selectedDateMeta.label}</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Time</p>
                <p className="mt-2 text-sm font-medium">{selectedDateRecord?.time || selectedDateExam?.time || 'No time recorded'}</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Event</p>
                <p className="mt-2 text-sm font-medium">{selectedDateExam?.title || selectedDateHoliday?.title || 'No event scheduled'}</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Confidence</p>
                <p className="mt-2 text-sm font-medium">{selectedDateRecord ? `${Math.round((selectedDateRecord.confidence || 0) * 100)}%` : 'Not available'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-medium">Details</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{selectedDateMeta.detail}</p>
              {selectedDateRecord?.engagementScore ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Engagement: {selectedDateRecord.engagementScore}% · {selectedDateRecord.emotionState || 'attentive'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'proofs' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card-panel p-6">
              <p className="text-lg font-semibold">Proof records</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                A snapshot is saved as soon as attendance is marked, so you can verify the exact proof later.
              </p>
              <div className="mt-5 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Snapshots saved</p>
                <p className="mt-2 text-3xl font-semibold">{records.filter((record) => record.proofImage).length}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Present and blocked attendance attempts both can keep proof snapshots.</p>
              </div>
            </div>

            <div className="card-panel p-6 lg:col-span-2">
              <p className="text-lg font-semibold">Latest attendance proof</p>
              {recentRecord?.proofImage ? (
                <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                  <img
                    src={recentRecord.proofImage}
                    alt="Latest attendance proof"
                    className="h-48 w-full rounded-[1.5rem] object-cover"
                  />
                  <div className="space-y-3 text-sm">
                    <p><span className="text-slate-500 dark:text-slate-400">Date:</span> {recentRecord.date}</p>
                    <p><span className="text-slate-500 dark:text-slate-400">Time:</span> {recentRecord.time}</p>
                    <p><span className="text-slate-500 dark:text-slate-400">Status:</span> <span className="capitalize">{recentRecord.status}</span></p>
                    <p><span className="text-slate-500 dark:text-slate-400">Location:</span> {recentRecord.locationLabel || 'Student Live Check-in'}</p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button onClick={() => setProofModalRecord(recentRecord)} className="action-secondary">
                        <Eye size={16} />
                        View full proof
                      </button>
                      <button onClick={() => downloadProof(recentRecord)} className="action-primary">
                        <Download size={16} />
                        Download proof
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No proof saved yet. Mark attendance once to generate a proof card.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {records.filter((record) => record.proofImage).map((record) => (
              <div key={`${record.id}-proof`} className="card-panel overflow-hidden p-4">
                <img
                  src={record.proofImage}
                  alt={`Attendance proof for ${record.date}`}
                  className="h-48 w-full rounded-[1.5rem] object-cover"
                />
                <div className="mt-4 space-y-2 text-sm">
                  <p className="font-medium">{record.date} · {record.time}</p>
                  <p className="text-slate-500 dark:text-slate-400">Status: <span className="capitalize text-slate-900 dark:text-white">{record.status}</span></p>
                  <p className="text-slate-500 dark:text-slate-400">Location: {record.locationLabel || 'Student Live Check-in'}</p>
                  <p className="text-slate-500 dark:text-slate-400">Saved: {record.proofCapturedAt ? format(parseISO(record.proofCapturedAt), 'dd MMM yyyy, hh:mm a') : 'Not available'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => setProofModalRecord(record)} className="action-secondary">
                    <Eye size={16} />
                    Preview
                  </button>
                  <button onClick={() => downloadProof(record)} className="action-primary">
                    <Download size={16} />
                    Download
                  </button>
                </div>
              </div>
            ))}
            {!records.some((record) => record.proofImage) ? (
              <div className="card-panel p-6 text-sm text-slate-500 dark:text-slate-400">
                Attendance proof snapshots will appear here after live attendance attempts.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {currentPage === 'profile' ? (
          <div className="space-y-6">
            <div className="card-panel p-6">
              <p className="text-lg font-semibold">Profile</p>
              <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                <p><span className="text-slate-500 dark:text-slate-400">Name:</span> {student?.name}</p>
                <p><span className="text-slate-500 dark:text-slate-400">Email:</span> {student?.email}</p>
                <p><span className="text-slate-500 dark:text-slate-400">Department:</span> {student?.department}</p>
                <p><span className="text-slate-500 dark:text-slate-400">Student code:</span> {student?.studentCode}</p>
                <p><span className="text-slate-500 dark:text-slate-400">Registered face:</span> {student?.faceRegistered ? 'Yes' : 'No'}</p>
                <p><span className="text-slate-500 dark:text-slate-400">Attendance percentage:</span> {student?.attendancePercentage || 0}%</p>
              </div>
            </div>

            {!student?.faceRegistered ? (
              <div className="card-panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">Complete face registration</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Your account is ready, but attendance scan needs your face dataset. Capture at least 5 clear samples and save them here.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-500">Face pending</span>
                </div>
                <div className="mt-4">
                  <FaceCapture onFramesChange={setFaceRegistrationFrames} maxFrames={6} label="Register student face profile" />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={registerStudentFace} className="action-primary" disabled={registeringFace}>
                    {registeringFace ? 'Saving face profile...' : 'Save face profile'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {currentPage === 'scan' ? (
          <div className="card-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Live Check-in</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Scan your face and attendance will be marked with the current time.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{cameraReady ? 'Camera on' : 'Camera off'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{student?.faceRegistered ? 'Dataset ready' : 'Dataset pending'}</span>
            </div>
          </div>
            <div className="mt-4 overflow-hidden rounded-[1.5rem] bg-slate-950">
              <video ref={videoRef} className="h-72 w-full object-cover" playsInline muted />
            </div>
            {!student?.faceRegistered ? (
              <div className="mt-4 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-500">Face registration required</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  This account can log in, but attendance scan will stay blocked until you register your face samples from the Profile page.
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={startCamera} className="action-primary">
              <Camera size={16} />
              Start camera
            </button>
            <button onClick={sendAttendanceOtp} className="action-secondary">
              <ShieldCheck size={16} />
              {attendanceOtpChallengeId ? 'Resend OTP' : 'Send OTP'}
            </button>
            <button onClick={markLiveAttendance} className="action-secondary">
              {scanning ? <RefreshCw size={16} className="animate-spin" /> : <ScanFace size={16} />}
              {scanning ? 'Checking...' : 'Scan & mark attendance'}
            </button>
            <button onClick={stopCamera} className="action-secondary">
              <Square size={16} />
              Stop
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-semibold">Attendance MFA</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Secure flow: camera + registered face + 6-digit OTP. Both a fresh login OTP and a sent attendance OTP are accepted here.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs ${attendanceOtpChallengeId ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {attendanceOtpChallengeId ? 'OTP sent' : 'OTP pending'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs ${student?.faceRegistered ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {student?.faceRegistered ? 'Face registered' : 'Face registration required'}
                </span>
              </div>
              {attendanceOtpStatus ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{attendanceOtpStatus}</p> : null}
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
              <label className="text-sm font-semibold" htmlFor="attendance-otp">
                Enter attendance OTP
              </label>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Enter either the valid OTP received during login or the attendance OTP sent here.
              </p>
              <input
                id="attendance-otp"
                className="field mt-4 w-full"
                placeholder="6-digit OTP"
                inputMode="numeric"
                maxLength={6}
                value={attendanceOtpCode}
                onChange={(event) => setAttendanceOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{scanStatus}</p>
          {scanError ? <p className="mt-2 text-sm text-rose-500">{scanError}</p> : null}
          {geoInfo?.allowed === false ? (
            <div className="mt-4 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
              <p className="text-sm font-semibold text-rose-400">Outside Authorized Area</p>
              <p className="mt-2 text-xs">
                {geoInfo?.message || 'Attendance blocked because you are outside the campus geo-fence.'}
              </p>
              <p className="mt-1 text-xs">
                Allowed zone: {geoInfo?.zone?.name || geoZone?.name} · Radius: {geoInfo?.zone?.radiusMeters || geoZone?.radiusMeters || 100}m
              </p>
              {typeof geoInfo?.accuracyMeters === 'number' ? (
                <p className="mt-1 text-xs">
                  GPS accuracy: {geoInfo.accuracyMeters}m · Effective radius used: {geoInfo.effectiveRadiusMeters || geoInfo?.zone?.radiusMeters || geoZone?.radiusMeters || 100}m
                </p>
              ) : null}
            </div>
          ) : null}
          {recentRecord?.suspicious ? (
            <div className="mt-4 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
              <p className="text-sm font-semibold text-rose-400">Suspicious Attendance Detected</p>
              <div className="mt-2 space-y-1 text-xs">
                {(recentRecord.suspiciousFlags || []).map((flag) => (
                  <p key={flag.code}>[{flag.label}] {flag.detail}</p>
                ))}
              </div>
            </div>
          ) : null}
          {activeAbsentRecord ? (
            <div className="mt-4 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-500">Smart Attendance Justification AI</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    An absent attempt was detected. Enter the reason below and the AI will analyze whether it looks genuine, suspicious, or fake.
                  </p>
                </div>
                <span className="rounded-full bg-slate-950/5 px-3 py-1 text-xs dark:bg-white/5">
                  {activeAbsentRecord.justification?.aiLabel ? `AI: ${activeAbsentRecord.justification.aiLabel}` : 'Reason pending'}
                </span>
              </div>

              {activeAbsentRecord.justification ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-slate-200/70 p-4 text-sm dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reason</p>
                    <p className="mt-2">{activeAbsentRecord.justification.reason}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200/70 p-4 text-sm dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">AI summary</p>
                    <p className="mt-2">{activeAbsentRecord.justification.aiSummary}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-200/70 p-4 text-sm dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Trust score</p>
                    <p className="mt-2 font-semibold">{activeAbsentRecord.justification.trustScore || student?.honestyScore || 80}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{activeAbsentRecord.justification.patternNote}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                  <div>
                    <label className="text-sm font-semibold" htmlFor={`absent-reason-${activeAbsentRecord.id}`}>
                      Why were you absent?
                    </label>
                    <textarea
                      id={`absent-reason-${activeAbsentRecord.id}`}
                      className="field mt-3 min-h-[120px] w-full"
                        placeholder="Example: I had a fever and had to visit the doctor..."
                      value={absenceReasonDrafts[activeAbsentRecord.id] || ''}
                      onChange={(event) => updateReasonDraft(activeAbsentRecord.id, event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor={`proof-note-${activeAbsentRecord.id}`}>
                      Proof note or supporting detail
                    </label>
                    <textarea
                      id={`proof-note-${activeAbsentRecord.id}`}
                      className="field mt-3 min-h-[120px] w-full"
                      placeholder="Example: Doctor visit, family emergency, bus breakdown..."
                      value={absenceProofDrafts[activeAbsentRecord.id] || ''}
                      onChange={(event) => updateProofDraft(activeAbsentRecord.id, event.target.value)}
                    />
                  </div>
                </div>
              )}

              {!activeAbsentRecord.justification ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    The AI review will appear in the parent notification and teacher dashboard after the reason is submitted.
                  </p>
                  <button
                    onClick={() => submitAbsenceReason(activeAbsentRecord)}
                    className="action-primary"
                    disabled={submittingJustificationId === activeAbsentRecord.id}
                  >
                    {submittingJustificationId === activeAbsentRecord.id ? 'Analyzing...' : 'Submit reason to AI'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Current user</p>
              <p className="mt-2 text-sm font-medium">{student?.name || user?.name || 'Student account'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Last check-in</p>
              <p className="mt-2 text-sm font-medium">{recentRecord ? `${recentRecord.date} at ${recentRecord.time}` : 'Not available'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Confidence</p>
              <p className="mt-2 text-sm font-medium">{recentRecord ? `${Math.round((recentRecord.confidence || 0) * 100)}%` : 'Pending'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Engagement</p>
              <p className="mt-2 text-sm font-medium">{recentRecord ? `${recentRecord.engagementScore || 0}% · ${recentRecord.emotionState || 'attentive'}` : 'Pending'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'history' ? (
        <div className="card-panel p-6">
          {pendingAbsentRecords.length ? (
            <div className="mb-6 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">Pending absence justifications</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    A reason has not been submitted for these records yet. After AI review, both the teacher and parent will get clearer context.
                  </p>
                </div>
                <span className="rounded-full bg-slate-950/5 px-3 py-1 text-xs dark:bg-white/5">
                  {pendingAbsentRecords.length} pending
                </span>
              </div>

              <div className="mt-4 grid gap-4">
                {pendingAbsentRecords.map((record) => (
                  <div key={`${record.id}-pending`} className="rounded-[1.25rem] border border-slate-200/70 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{record.date} · {record.time}</p>
                      <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">{record.absentReason || 'Absent attempt recorded'}</span>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr_auto]">
                      <textarea
                        className="field min-h-[110px] w-full"
                        placeholder="Explain why you were absent..."
                        value={absenceReasonDrafts[record.id] || ''}
                        onChange={(event) => updateReasonDraft(record.id, event.target.value)}
                      />
                      <textarea
                        className="field min-h-[110px] w-full"
                        placeholder="Optional supporting note..."
                        value={absenceProofDrafts[record.id] || ''}
                        onChange={(event) => updateProofDraft(record.id, event.target.value)}
                      />
                      <button
                        onClick={() => submitAbsenceReason(record)}
                        className="action-primary self-start"
                        disabled={submittingJustificationId === record.id}
                      >
                        {submittingJustificationId === record.id ? 'Analyzing...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">Attendance history</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="month"
                className="field px-4 py-3"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
              />
              <button onClick={downloadMonthlyReport} className="action-secondary">
                Download PDF
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Confidence</th>
                  <th className="px-4 py-3 text-left">Engagement</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">AI review</th>
                  <th className="px-4 py-3 text-left">Security</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3">{record.date}</td>
                    <td className="px-4 py-3">{record.time}</td>
                    <td className="px-4 py-3 capitalize">{record.status}</td>
                    <td className="px-4 py-3">{Math.round((record.confidence || 0) * 100)}%</td>
                    <td className="px-4 py-3 capitalize">{record.engagementScore || 0}% · {record.emotionState || 'attentive'}</td>
                    <td className="px-4 py-3">
                      {record.justification?.reason || record.absentReason || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {record.justification ? (
                        <div className="space-y-1">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            record.justification.aiLabel === 'genuine'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : record.justification.aiLabel === 'fake'
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {record.justification.aiLabel}
                          </span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Trust {record.justification.trustScore || student?.honestyScore || 80}</p>
                        </div>
                      ) : record.status === 'absent' ? (
                        <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-500">Pending</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {record.suspicious ? (
                        <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-500">Suspicious</span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={downloadAttendanceHistoryPdf} className="action-primary">
              Download Attendance History PDF
            </button>
          </div>
        </div>
      ) : null}

      {currentPage === 'downloads' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card-panel p-6">
              <p className="text-lg font-semibold">Monthly attendance report</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Select a month and download a structured PDF with confidence, engagement, and security details.
              </p>
              <div className="mt-5 space-y-4">
                <input
                  type="month"
                  className="field px-4 py-3"
                  value={reportMonth}
                  onChange={(event) => setReportMonth(event.target.value)}
                />
                <button onClick={downloadMonthlyReport} className="action-primary">
                  Download Monthly PDF
                </button>
              </div>
            </div>

            <div className="card-panel p-6">
              <p className="text-lg font-semibold">Full attendance history</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Download your complete attendance history as a separate PDF report from one dedicated section.
              </p>
              <div className="mt-5 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Records available</p>
                <p className="mt-2 text-3xl font-semibold">{records.length}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Includes present, absent, geo-fence attempts, confidence, and engagement details.
                </p>
              </div>
              <button onClick={downloadAttendanceHistoryPdf} className="action-primary mt-5">
                Download Full History PDF
              </button>
            </div>
          </div>

          <div className="card-panel p-6">
            <p className="text-lg font-semibold">Available exports</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium">Monthly PDF</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Month-wise attendance report for sharing and submission.</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium">Full history PDF</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Complete attendance ledger with all marked entries and statuses.</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium">Smart details</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Confidence, engagement, suspicious flags, and security state included.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'assistant' ? <AIChatAssistant role="student" /> : null}

      {proofModalRecord?.proofImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-auto p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold">Attendance Proof Preview</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {proofModalRecord.date} · {proofModalRecord.time} · {proofModalRecord.locationLabel || 'Student Live Check-in'}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadProof(proofModalRecord)} className="action-primary">
                  <Download size={16} />
                  Download proof
                </button>
                <button onClick={() => setProofModalRecord(null)} className="action-secondary">Close</button>
              </div>
            </div>
            <img
              src={proofModalRecord.proofImage}
              alt="Full attendance proof"
              className="mt-5 max-h-[70vh] w-full rounded-[1.75rem] object-contain"
            />
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
