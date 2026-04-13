import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import morgan from 'morgan'
import nodemailer from 'nodemailer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'mock-db.json')

const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'change_me_super_secret',
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',
  faceApiUrl: process.env.FACE_API_URL || 'http://127.0.0.1:5001',
  adminEmail: process.env.ADMIN_EMAIL || 'harshitakothari2703@gmail.com',
  adminPassword: process.env.ADMIN_PASS || 'Harshita@1234',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  parentAlertWebhookUrl: process.env.PARENT_ALERT_WEBHOOK_URL || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '',
}

const AUTHORIZED_ZONE = {
  name: 'Dexter Global School, Mandsaur',
  latitude: 24.069724,
  longitude: 75.077568,
  radiusMeters: 200,
}

const DEFAULT_SYSTEM_CONFIG = {
  studentAttendanceWindow: {
    start: '09:00',
    end: '17:00',
  },
  teacherAttendanceWindow: {
    start: '09:00',
    end: '17:00',
  },
  geoFence: {
    name: AUTHORIZED_ZONE.name,
    latitude: AUTHORIZED_ZONE.latitude,
    longitude: AUTHORIZED_ZONE.longitude,
    radiusMeters: AUTHORIZED_ZONE.radiusMeters,
  },
}

const ACADEMIC_EVENTS = [
  { date: '2026-04-18', title: 'Unit Test - Mathematics', type: 'exam', time: '11:00 am' },
  { date: '2026-04-24', title: 'Practical Assessment', type: 'exam', time: '09:30 am' },
  { date: '2026-04-14', title: 'Science activity day', type: 'event', time: '10:00 am' },
]

const HOLIDAY_MONTH_DAYS = new Set(['01-26', '08-15', '10-02', '12-25'])
const DAILY_ATTENDANCE_START_HOUR = 9
const DAILY_ATTENDANCE_CUTOFF_HOUR = 17

fs.mkdirSync(DATA_DIR, { recursive: true })

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], attendance: [], notifications: [], otpChallenges: [], interventions: [], teacherAttendance: [], academicCalendar: ACADEMIC_EVENTS, systemConfig: DEFAULT_SYSTEM_CONFIG }
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  return {
    users: db.users || [],
    attendance: db.attendance || [],
    notifications: db.notifications || [],
    otpChallenges: db.otpChallenges || [],
    interventions: db.interventions || [],
    teacherAttendance: db.teacherAttendance || [],
    academicCalendar: db.academicCalendar || ACADEMIC_EVENTS,
    systemConfig: {
      ...DEFAULT_SYSTEM_CONFIG,
      ...(db.systemConfig || {}),
      studentAttendanceWindow: {
        ...DEFAULT_SYSTEM_CONFIG.studentAttendanceWindow,
        ...(db.systemConfig?.studentAttendanceWindow || {}),
      },
      teacherAttendanceWindow: {
        ...DEFAULT_SYSTEM_CONFIG.teacherAttendanceWindow,
        ...(db.systemConfig?.teacherAttendanceWindow || {}),
      },
      geoFence: {
        ...DEFAULT_SYSTEM_CONFIG.geoFence,
        ...(db.systemConfig?.geoFence || {}),
      },
    },
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, { expiresIn: '7d' })
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user
  return safeUser
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function dispatchEmail({ to, subject, html, text }) {
  if (!to) {
    return { status: 'failed', detail: 'Recipient email is required.' }
  }

  if (env.resendApiKey && env.resendFromEmail) {
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: env.resendFromEmail,
          to: [to],
          subject,
          html,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${env.resendApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )
      return { status: 'sent', detail: `Email sent to ${to}.` }
    } catch (error) {
      // fall through to SMTP
    }
  }

  if (env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFromEmail) {
    try {
      const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      })

      await transporter.sendMail({
        from: env.smtpFromEmail,
        to,
        subject,
        html,
        text,
      })
      return { status: 'sent', detail: `SMTP email sent to ${to}.` }
    } catch (error) {
      return { status: 'failed', detail: error.message }
    }
  }

  return { status: 'simulated', detail: 'No email provider configured. OTP saved in local database only.' }
}

async function dispatchParentAlert(notification) {
  if (env.resendApiKey && env.resendFromEmail && notification.parentContact?.email) {
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: env.resendFromEmail,
          to: [notification.parentContact.email],
          subject: notification.title,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>${notification.title}</h2>
              <p>${notification.message}</p>
              <p><strong>Student:</strong> ${notification.studentName}</p>
              <p><strong>Generated:</strong> ${new Date(notification.createdAt).toLocaleString('en-IN')}</p>
            </div>
          `,
        },
        {
          headers: {
            Authorization: `Bearer ${env.resendApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )
      return { status: 'sent', detail: `Email sent to ${notification.parentContact.email}.` }
    } catch (error) {
      return { status: 'failed', detail: error.message }
    }
  }

  if (env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFromEmail && notification.parentContact?.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      })

      await transporter.sendMail({
        from: env.smtpFromEmail,
        to: notification.parentContact.email,
        subject: notification.title,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p><strong>Student:</strong> ${notification.studentName}</p>
            <p><strong>Generated:</strong> ${new Date(notification.createdAt).toLocaleString('en-IN')}</p>
          </div>
        `,
      })

      return { status: 'sent', detail: `SMTP email sent to ${notification.parentContact.email}.` }
    } catch (error) {
      return { status: 'failed', detail: error.message }
    }
  }

  if (!env.parentAlertWebhookUrl) {
    return { status: 'simulated', detail: 'No webhook configured. Alert stored in dashboard log.' }
  }

  try {
    await axios.post(env.parentAlertWebhookUrl, notification)
    return { status: 'sent', detail: 'Alert delivered to configured webhook.' }
  } catch (error) {
    return { status: 'failed', detail: error.message }
  }
}

async function createParentNotification(db, { student, type, title, message, attendanceRecord, skipDedup = false }) {
  const parentEmail = student?.parentContact?.email || ''
  const parentPhone = student?.parentContact?.phone || ''
  const parentName = student?.parentContact?.name || 'Parent'

  if (!parentEmail && !parentPhone) return null

  if (!skipDedup) {
    const duplicate = db.notifications.find(
      (item) =>
        item.studentId === student.id &&
        item.type === type &&
        item.attendanceRecordId === attendanceRecord?.id &&
        item.createdAt?.slice(0, 10) === new Date().toISOString().slice(0, 10),
    )
    if (duplicate) return duplicate
  }

  const notification = {
    id: createId('notif'),
    studentId: student.id,
    studentName: student.name,
    type,
    title,
    message,
    parentContact: {
      name: parentName,
      email: parentEmail,
      phone: parentPhone,
    },
    attendanceRecordId: attendanceRecord?.id || null,
    createdAt: new Date().toISOString(),
  }

  const delivery = await dispatchParentAlert(notification)
  notification.deliveryStatus = delivery.status
  notification.deliveryDetail = delivery.detail
  db.notifications.unshift(notification)
  return notification
}

function countAttendance(records = []) {
  return records.reduce(
    (summary, record) => {
      if (record.status === 'present') summary.present += 1
      if (record.status === 'absent') summary.absent += 1
      if (record.suspicious) summary.suspicious += 1
      return summary
    },
    { present: 0, absent: 0, suspicious: 0 },
  )
}

function getAcademicCalendar(db = null) {
  return (db?.academicCalendar || ACADEMIC_EVENTS).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function getUpcomingAcademicEvents(db = null) {
  const today = new Date().toISOString().slice(0, 10)
  return getAcademicCalendar(db).filter((item) => item.date >= today).slice(0, 6)
}

function formatIsoLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getIndiaDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  }
}

function parseConfigTime(value, fallbackHour) {
  const source = String(value || '').trim()
  const match = source.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return { hour: fallbackHour, minute: 0 }
  }
  return {
    hour: Math.max(0, Math.min(23, Number(match[1]))),
    minute: Math.max(0, Math.min(59, Number(match[2]))),
  }
}

function getSystemConfig(db = null) {
  return (db || readDb()).systemConfig || DEFAULT_SYSTEM_CONFIG
}

function getStudentAttendanceWindowConfig(db = null) {
  const config = getSystemConfig(db)
  const start = parseConfigTime(config.studentAttendanceWindow?.start, DAILY_ATTENDANCE_START_HOUR)
  const end = parseConfigTime(config.studentAttendanceWindow?.end, DAILY_ATTENDANCE_CUTOFF_HOUR)
  return { start, end }
}

function getTeacherAttendanceWindowConfig(db = null) {
  const config = getSystemConfig(db)
  const start = parseConfigTime(config.teacherAttendanceWindow?.start, DAILY_ATTENDANCE_START_HOUR)
  const end = parseConfigTime(config.teacherAttendanceWindow?.end, DAILY_ATTENDANCE_CUTOFF_HOUR)
  return { start, end }
}

function getGeoFenceZone(db = null) {
  const geoFence = getSystemConfig(db).geoFence || DEFAULT_SYSTEM_CONFIG.geoFence
  return {
    name: geoFence.name || AUTHORIZED_ZONE.name,
    latitude: Number(geoFence.latitude ?? AUTHORIZED_ZONE.latitude),
    longitude: Number(geoFence.longitude ?? AUTHORIZED_ZONE.longitude),
    radiusMeters: Number(geoFence.radiusMeters ?? AUTHORIZED_ZONE.radiusMeters),
  }
}

function isHolidayDate(date, db = null) {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (HOLIDAY_MONTH_DAYS.has(monthDay)) return true
  const isoDate = formatIsoLocalDate(date)
  return getAcademicCalendar(db).some((item) => item.date === isoDate && ['holiday', 'no-class'].includes(item.type))
}

function isSchoolAttendanceDay(date, db = null) {
  const day = date.getDay()
  if (day === 0) return false
  if (isHolidayDate(date, db)) return false
  return true
}

function reconcileStudentDailyAttendance(db, student, now = new Date()) {
  if (!student || student.role !== 'student') return false

  const createdDate = new Date(student.createdAt || now)
  createdDate.setHours(0, 0, 0, 0)

  const studentWindow = getStudentAttendanceWindowConfig(db)
  const endDate = new Date(now)
  if (now.getHours() < studentWindow.end.hour || (now.getHours() === studentWindow.end.hour && now.getMinutes() <= studentWindow.end.minute)) {
    endDate.setDate(endDate.getDate() - 1)
  }
  endDate.setHours(0, 0, 0, 0)

  if (createdDate > endDate) return false

  const studentRecords = db.attendance.filter((record) => record.studentId === student.id)
  const existingDates = new Set(studentRecords.map((record) => record.date))
  let changed = false

  for (let cursor = new Date(createdDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const recordDate = formatIsoLocalDate(cursor)
    if (!isSchoolAttendanceDay(cursor, db)) continue
    if (existingDates.has(recordDate)) continue

    db.attendance.push({
      id: createId('att'),
      studentId: student.id,
      date: recordDate,
      time: '17:00:00',
      status: 'absent',
      method: 'daily-auto-absent',
      confidence: 0,
      emotionState: 'pending',
      engagementScore: 0,
      proofImage: null,
      proofCapturedAt: null,
      locationLabel: 'Daily attendance reconciliation',
      gps: null,
      geoFenceStatus: null,
      absentReason: 'Student did not mark attendance between 09:00 and 17:00.',
      justification: null,
      suspicious: false,
      suspiciousFlags: [],
      suspiciousScore: 0,
      scanEvents: [],
      createdAt: `${recordDate}T17:00:00.000Z`,
      autoGenerated: true,
    })
    existingDates.add(recordDate)
    changed = true
  }

  const totalRecords = db.attendance.filter((record) => record.studentId === student.id).length
  student.attendancePercentage = Math.min(100, totalRecords * 5)

  return changed
}

function evaluateStudentAttendanceWindow(now = new Date(), db = null) {
  const { hour, minute } = getIndiaDateTimeParts(now)
  const { start, end } = getStudentAttendanceWindowConfig(db)
  const beforeWindow = hour < start.hour || (hour === start.hour && minute < start.minute)
  const afterWindow = hour > end.hour || (hour === end.hour && minute > end.minute)
  const formatTime = ({ hour: valueHour, minute: valueMinute }) =>
    `${String(valueHour).padStart(2, '0')}:${String(valueMinute).padStart(2, '0')}`

  return {
    beforeWindow,
    afterWindow,
    allowed: !beforeWindow && !afterWindow,
    message: beforeWindow
      ? `Attendance window starts at ${formatTime(start)}.`
      : afterWindow
        ? `Attendance can only be marked until ${formatTime(end)}. Today is marked absent if check-in was missed.`
        : '',
  }
}

function reconcileDailyAttendanceForUsers(db, studentIds = []) {
  const targets = studentIds.length
    ? db.users.filter((user) => user.role === 'student' && studentIds.includes(user.id))
    : db.users.filter((user) => user.role === 'student')

  let changed = false
  for (const student of targets) {
    if (reconcileStudentDailyAttendance(db, student)) {
      changed = true
    }
  }
  if (changed) {
    db.attendance.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return changed
}

function getTeachers(db) {
  return db.users.filter((user) => user.role === 'teacher')
}

function isTeacherLate(now = new Date()) {
  const { hour, minute } = getIndiaDateTimeParts(now)
  const { start } = getTeacherAttendanceWindowConfig()
  return hour > start.hour || (hour === start.hour && minute > start.minute)
}

function evaluateTeacherAttendanceWindow(now = new Date(), db = null) {
  const { hour, minute } = getIndiaDateTimeParts(now)
  const { start, end } = getTeacherAttendanceWindowConfig(db)
  const beforeWindow = hour < start.hour || (hour === start.hour && minute < start.minute)
  const afterWindow = hour > end.hour || (hour === end.hour && minute > end.minute)
  const formatTime = ({ hour: valueHour, minute: valueMinute }) =>
    `${String(valueHour).padStart(2, '0')}:${String(valueMinute).padStart(2, '0')}`

  return {
    beforeWindow,
    afterWindow,
    allowed: !beforeWindow && !afterWindow,
    message: beforeWindow
      ? `Teacher attendance window starts at ${formatTime(start)}.`
      : afterWindow
        ? `Teacher attendance can only be marked until ${formatTime(end)}. Today is marked absent if check-in was missed.`
        : '',
  }
}

function createAbsentTeacherAttendanceRecord({ db, teacher, now, locationLabel, gps, reason, image }) {
  const indiaNow = getIndiaDateTimeParts(now)
  const date = indiaNow.date
  const time = indiaNow.time
  let record = (db.teacherAttendance || []).find((item) => item.teacherId === teacher.id && item.date === date)

  if (!record) {
    record = {
      id: createId('teach_att'),
      teacherId: teacher.id,
      name: teacher.name,
      date,
      time,
      status: 'absent',
      remark: 'Absent',
      late: false,
      location: gps?.latitude && gps?.longitude ? 'Campus' : 'Not captured',
      locationLabel: locationLabel || 'Teacher Check-In',
      gps: gps?.latitude && gps?.longitude ? gps : null,
      geoFenceStatus: null,
      faceMatch: false,
      faceConfidence: 0,
      proofImage: image || null,
      proofCapturedAt: now.toISOString(),
      absentReason: reason,
      createdAt: now.toISOString(),
    }
    db.teacherAttendance.push(record)
  } else {
    record.time = time
    record.status = 'absent'
    record.remark = 'Absent'
    record.late = false
    record.absentReason = reason
    record.locationLabel = locationLabel || record.locationLabel
    record.gps = gps?.latitude && gps?.longitude ? gps : record.gps
    record.faceMatch = false
    record.faceConfidence = 0
    record.proofImage = image || record.proofImage || null
    record.proofCapturedAt = now.toISOString()
  }

  return record
}

function buildTeacherAttendanceSummary(db, { date = getIndiaDateTimeParts(new Date()).date, teacherId = '' } = {}) {
  const teachers = getTeachers(db)
  const filteredTeachers = teacherId ? teachers.filter((teacher) => teacher.id === teacherId) : teachers
  const dailyRecords = (db.teacherAttendance || [])
    .filter((record) => record.date === date)
    .filter((record) => !teacherId || record.teacherId === teacherId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record) => ({
      ...record,
      teacher: sanitizeUser(db.users.find((user) => user.id === record.teacherId) || {}),
    }))

  const presentRecords = dailyRecords.filter((record) => record.status === 'present')
  const explicitAbsentRecords = dailyRecords.filter((record) => record.status === 'absent')

  const presentTeacherIds = new Set(presentRecords.map((record) => record.teacherId))
  const absentTeacherIds = new Set(explicitAbsentRecords.map((record) => record.teacherId))
  const absentTeachers = [
    ...explicitAbsentRecords,
    ...filteredTeachers
    .filter((teacher) => !presentTeacherIds.has(teacher.id))
    .filter((teacher) => !absentTeacherIds.has(teacher.id))
    .map((teacher) => ({
      id: teacher.id,
      teacherId: teacher.id,
      name: teacher.name,
      email: teacher.email,
      department: teacher.department || 'General',
      status: 'absent',
      remark: 'No teacher check-in found for this date.',
      teacher: sanitizeUser(teacher),
    })),
  ]

  const lateRecords = presentRecords.filter((record) => record.late)
  const alerts = []
  if (lateRecords.length) {
    alerts.push(`${lateRecords.length} teachers late on ${date}`)
  }
  if (absentTeachers.length) {
    alerts.push(`${absentTeachers.length} teachers absent on ${date}`)
  }

  return {
    date,
    teachers: filteredTeachers.map(sanitizeUser),
    presentRecords,
    lateRecords,
    absentTeachers,
    stats: {
      totalTeachers: filteredTeachers.length,
      presentToday: presentRecords.length,
      absentToday: absentTeachers.length,
      lateToday: lateRecords.length,
      latePercentage: presentRecords.length ? Number(((lateRecords.length / presentRecords.length) * 100).toFixed(1)) : 0,
    },
    alerts,
  }
}

function normalizeReasonFingerprint(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getStudentAbsentRecords(studentId, attendance = []) {
  return attendance
    .filter((record) => record.studentId === studentId && record.status === 'absent')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function summarizeJustificationSignals(records = []) {
  return records.reduce(
    (summary, record) => {
      const label = record.justification?.aiLabel || 'pending'
      summary.total += 1
      summary[label] = (summary[label] || 0) + 1
      if (record.justification?.repeatedPattern) summary.repeated += 1
      return summary
    },
    { total: 0, genuine: 0, suspicious: 0, fake: 0, pending: 0, repeated: 0 },
  )
}

function createLocalReasonAnalysis({ reason, student, previousReasons = [], absentRecord }) {
  const text = String(reason || '').trim()
  const normalized = normalizeReasonFingerprint(text)
  const previousFingerprints = previousReasons.map(normalizeReasonFingerprint).filter(Boolean)
  const repeatedCount = previousFingerprints.filter((item) => item === normalized).length
  const totalPrevious = previousFingerprints.length

  const genuineKeywords = [
    'fever',
    'sick',
    'medical',
    'doctor',
    'hospital',
    'injury',
    'accident',
    'family emergency',
    'emergency',
    'health',
    'tabiyat',
    'bimar',
    'ill',
  ]
  const suspiciousKeywords = [
    'traffic',
    'network',
    'late',
    'oversleep',
    'sleep',
    'busy',
    'some work',
    'work tha',
    'function',
    'bus miss',
    'bus',
    'rain',
  ]

  const hasGenuineKeyword = genuineKeywords.some((keyword) => normalized.includes(keyword))
  const hasSuspiciousKeyword = suspiciousKeywords.some((keyword) => normalized.includes(keyword))
  const tooShort = normalized.split(' ').filter(Boolean).length < 3
  const repeatedPattern = repeatedCount >= 1
  const examSoon = getAcademicCalendar().some((event) => {
    const eventDate = new Date(event.date)
    const absentDate = new Date(absentRecord?.date || new Date().toISOString().slice(0, 10))
    const gap = Math.round((eventDate - absentDate) / (1000 * 60 * 60 * 24))
    return gap >= 0 && gap <= 2
  })

  let aiLabel = 'genuine'
  let summary = 'Reason looks reasonable for an absence.'
  let trustDelta = 4
  let patternNote = repeatedPattern
    ? 'Similar excuse pattern detected from recent absence history.'
    : 'No repeated excuse pattern detected in recent history.'

  if (tooShort) {
    aiLabel = 'fake'
    summary = 'Reason is too short or too vague to verify properly.'
    trustDelta = -10
  } else if (repeatedPattern && (hasSuspiciousKeyword || totalPrevious >= 2)) {
    aiLabel = 'fake'
    summary = 'Repeated excuse detected again in absence history.'
    trustDelta = -12
  } else if (hasGenuineKeyword) {
    aiLabel = repeatedPattern ? 'suspicious' : 'genuine'
    summary = repeatedPattern
      ? 'Medical-style reason is present, but a repeated pattern needs review.'
      : 'Reason looks like a valid medical or emergency explanation.'
    trustDelta = repeatedPattern ? -2 : 8
  } else if (hasSuspiciousKeyword || repeatedPattern || examSoon) {
    aiLabel = 'suspicious'
    summary = repeatedPattern
      ? 'Reason is similar to earlier excuses and should be reviewed.'
      : examSoon
        ? 'Reason came close to an exam/event window, so teacher review is recommended.'
        : 'Reason may be valid, but it looks weak or difficult to verify.'
    trustDelta = repeatedPattern ? -8 : -4
  }

  const trustScore = Math.max(15, Math.min(100, Math.round((student?.honestyScore ?? 80) + trustDelta)))

  return {
    aiLabel,
    summary,
    patternNote,
    repeatedPattern,
    trustScore,
    confidence: repeatedPattern || hasSuspiciousKeyword ? 0.74 : hasGenuineKeyword ? 0.87 : 0.67,
    mode: 'local',
  }
}

async function analyzeAttendanceJustification({ reason, student, previousReasons = [], absentRecord }) {
  const fallback = createLocalReasonAnalysis({ reason, student, previousReasons, absentRecord })

  if (!env.openaiApiKey) {
    return fallback
  }

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model: env.openaiModel,
        instructions:
          'You analyze student absence reasons for an attendance system. Return strict JSON only with keys: aiLabel, summary, patternNote, repeatedPattern, trustScore, confidence. aiLabel must be one of genuine, suspicious, fake. Use simple professional judgment. Consider repeat patterns and vague excuses. Do not include markdown.',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  studentName: student?.name || '',
                  currentHonestyScore: student?.honestyScore ?? 80,
                  absenceDate: absentRecord?.date || '',
                  reason,
                  previousReasons,
                }),
              },
            ],
          },
        ],
        max_output_tokens: 220,
      },
      {
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.filter((item) => item.type === 'output_text')
        ?.map((item) => item.text)
        ?.join('\n')

    if (!outputText?.trim()) {
      return fallback
    }

    const parsed = JSON.parse(outputText.trim())
    const aiLabel = ['genuine', 'suspicious', 'fake'].includes(parsed.aiLabel) ? parsed.aiLabel : fallback.aiLabel
    return {
      aiLabel,
      summary: String(parsed.summary || fallback.summary),
      patternNote: String(parsed.patternNote || fallback.patternNote),
      repeatedPattern: Boolean(parsed.repeatedPattern),
      trustScore: Math.max(15, Math.min(100, Number(parsed.trustScore ?? fallback.trustScore))),
      confidence: Math.max(0.5, Math.min(0.99, Number(parsed.confidence ?? fallback.confidence))),
      mode: 'openai',
    }
  } catch (error) {
    console.warn('Reason analysis fallback triggered:', error.response?.data?.error?.message || error.message)
    return fallback
  }
}

function getRoleContext(req, db) {
  if (req.user.role === 'student') {
    const student = db.users.find((item) => item.id === req.user.id)
    const records = db.attendance
      .filter((record) => record.studentId === req.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const counts = countAttendance(records)
    const latest = records[0] || null
    const lowAttendance = (student?.attendancePercentage || 0) < 75
    const absentRecords = getStudentAbsentRecords(req.user.id, db.attendance)
    const justificationSignals = summarizeJustificationSignals(absentRecords)

    return {
      role: 'student',
      student: student ? sanitizeUser(student) : null,
      attendancePercentage: student?.attendancePercentage || 0,
      totalRecords: records.length,
      presentCount: counts.present,
      absentCount: counts.absent,
      suspiciousCount: counts.suspicious,
      latestRecord: latest,
      upcomingEvents: getUpcomingAcademicEvents(db),
      lowAttendance,
      parentEmail: student?.parentContact?.email || '',
      honestyScore: student?.honestyScore ?? 80,
      absenceJustificationSummary: justificationSignals,
    }
  }

  const students = db.users.filter((item) => item.role === 'student')
  const records = db.attendance.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const recentAlerts = db.notifications.slice(0, 5)
  const suspiciousRecords = records.filter((record) => record.suspicious).slice(0, 5)
  const justificationRecords = records
    .filter((record) => record.status === 'absent' && record.justification)
    .slice(0, 8)
  const justificationSummary = summarizeJustificationSignals(records.filter((record) => record.status === 'absent'))

  return {
    role: 'teacher',
    totalStudents: students.length,
    totalAttendanceRecords: records.length,
    suspiciousCount: suspiciousRecords.length,
    lowAttendanceCount: students.filter((student) => (student.attendancePercentage || 0) < 75).length,
    recentRecords: records.slice(0, 5).map((record) => ({
      ...record,
      student: sanitizeUser(db.users.find((item) => item.id === record.studentId) || {}),
    })),
    recentAlerts,
    upcomingEvents: getUpcomingAcademicEvents(db),
    justificationSummary,
    recentJustifications: justificationRecords.map((record) => ({
      ...record,
      student: sanitizeUser(db.users.find((item) => item.id === record.studentId) || {}),
    })),
  }
}

function normalizeAssistantLanguage(language = 'en') {
  const normalized = String(language || 'en').toLowerCase().trim()
  if (['english', 'en'].includes(normalized)) return 'en'
  if (['hinglish', 'hi-en'].includes(normalized)) return 'hinglish'
  if (['hindi', 'hi'].includes(normalized)) return 'hi'
  if (['marathi', 'mr'].includes(normalized)) return 'mr'
  if (['french', 'fr'].includes(normalized)) return 'fr'
  return 'en'
}

function assistantLanguageInstruction(language = 'en') {
  const normalized = normalizeAssistantLanguage(language)
  const instructions = {
    en: 'Answer in clear English.',
    hinglish: 'Answer in simple Hinglish using English script.',
    hi: 'Answer in simple Hindi.',
    mr: 'Answer in simple Marathi.',
    fr: 'Answer in simple French.',
  }
  return instructions[normalized] || instructions.en
}

function buildAssistantPrompt(context, message, history = [], language = 'en') {
  const shortHistory = history.slice(-6).map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: String(item.content || '').slice(0, 500),
  }))

  return {
    instructions:
      `You are VisionOS AI Chatbot Assistant for a face-recognition attendance platform. ${assistantLanguageInstruction(language)} Use short helpful paragraphs, no markdown tables, no hallucinated data. If schedule or class data is missing, say that clearly and use only the provided context. End with one practical suggestion when useful.`,
    input: [
      ...shortHistory.map((item) => ({
        role: item.role,
        content: [{ type: 'input_text', text: item.content }],
      })),
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser question:\n${message}`,
          },
        ],
      },
    ],
  }
}

function getWeekdayLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  return date.toLocaleDateString('en-IN', { weekday: 'long' })
}

function getTimeBucket(timeString = '') {
  const hour = Number(String(timeString).split(':')[0] || 0)
  if (hour < 12) return 'morning'
  if (hour < 16) return 'afternoon'
  return 'evening'
}

function buildStudentInsightContext(db, studentId) {
  const student = db.users.find((item) => item.id === studentId && item.role === 'student')
  if (!student) return null

  const records = db.attendance
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const absentRecords = records.filter((record) => record.status === 'absent')
  const presentRecords = records.filter((record) => record.status === 'present')
  const suspiciousRecords = records.filter((record) => record.suspicious)
  const weekdayAbsenceMap = new Map()
  const engagementBuckets = {
    morning: [],
    afternoon: [],
    evening: [],
  }

  for (const record of absentRecords) {
    const weekday = getWeekdayLabel(record.date)
    weekdayAbsenceMap.set(weekday, (weekdayAbsenceMap.get(weekday) || 0) + 1)
  }

  for (const record of presentRecords) {
    const bucket = getTimeBucket(record.time)
    engagementBuckets[bucket].push(record.engagementScore || 0)
  }

  const frequentAbsentDay = [...weekdayAbsenceMap.entries()].sort((a, b) => b[1] - a[1])[0] || null
  const averageEngagement = (items) => (items.length ? Math.round(items.reduce((sum, value) => sum + value, 0) / items.length) : 0)
  const morningEngagement = averageEngagement(engagementBuckets.morning)
  const afternoonEngagement = averageEngagement(engagementBuckets.afternoon)
  const eveningEngagement = averageEngagement(engagementBuckets.evening)
  const latestReason = absentRecords.find((record) => record.justification)?.justification || null

  return {
    student: sanitizeUser(student),
    attendancePercentage: student.attendancePercentage || 0,
    honestyScore: student.honestyScore ?? 80,
    presentCount: presentRecords.length,
    absentCount: absentRecords.length,
    suspiciousCount: suspiciousRecords.length,
    frequentAbsentDay: frequentAbsentDay ? { day: frequentAbsentDay[0], count: frequentAbsentDay[1] } : null,
    morningEngagement,
    afternoonEngagement,
    eveningEngagement,
    latestReason,
    recentRecords: records.slice(0, 8),
  }
}

function createLocalStudentInsightReport(context) {
  const lines = []
  lines.push(`This student has ${context.attendancePercentage}% attendance with ${context.presentCount} present and ${context.absentCount} absent records.`)

  if (context.frequentAbsentDay?.count) {
    lines.push(`Most absences appear on ${context.frequentAbsentDay.day}s (${context.frequentAbsentDay.count} times).`)
  } else {
    lines.push('No strong weekday absence pattern is visible yet.')
  }

  if (context.afternoonEngagement && context.afternoonEngagement < Math.max(context.morningEngagement, 55)) {
    lines.push(`Engagement looks lower in afternoon sessions (${context.afternoonEngagement}%) compared with morning performance.`)
  } else if (context.morningEngagement || context.afternoonEngagement || context.eveningEngagement) {
    const strongestBucket = [
      ['morning', context.morningEngagement],
      ['afternoon', context.afternoonEngagement],
      ['evening', context.eveningEngagement],
    ].sort((a, b) => b[1] - a[1])[0]
    lines.push(`Best engagement currently appears in ${strongestBucket[0]} sessions (${strongestBucket[1]}%).`)
  } else {
    lines.push('Engagement trend is still limited because enough present records are not available yet.')
  }

  if (context.suspiciousCount) {
    lines.push(`${context.suspiciousCount} suspicious attendance flags have been recorded and should be reviewed.`)
  }

  if (context.latestReason) {
    lines.push(`Latest absence reason was marked as ${context.latestReason.aiLabel} with honesty score ${context.latestReason.trustScore}.`)
  }

  if (context.attendancePercentage < 75) {
    lines.push('Overall recommendation: this student needs attendance intervention and closer weekly tracking.')
  } else {
    lines.push('Overall recommendation: attendance is manageable, but pattern monitoring should continue.')
  }

  return lines.join(' ')
}

async function generateStudentInsightReport(context) {
  const fallback = createLocalStudentInsightReport(context)
  if (!env.openaiApiKey) {
    return { report: fallback, mode: 'local' }
  }

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model: env.openaiModel,
        instructions:
          'You generate short professional teacher-facing student attendance summaries. Use only provided context. Output one concise paragraph in simple English with 3-5 observations and one recommendation. Do not invent classes or data.',
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(context, null, 2) }],
          },
        ],
        max_output_tokens: 220,
      },
      {
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.filter((item) => item.type === 'output_text')
        ?.map((item) => item.text)
        ?.join('\n')

    if (outputText?.trim()) {
      return { report: outputText.trim(), mode: 'openai' }
    }
  } catch (error) {
    console.warn('Student insight fallback triggered:', error.response?.data?.error?.message || error.message)
  }

  return { report: fallback, mode: 'local' }
}

function buildStudentInterventionContext(db, studentId) {
  const insight = buildStudentInsightContext(db, studentId)
  if (!insight) return null

  const records = insight.recentRecords || []
  const absentStreak = records.reduce((count, record) => {
    if (record.status === 'absent') return count + 1
    return count
  }, 0)
  const lowEngagementBuckets = [insight.morningEngagement, insight.afternoonEngagement, insight.eveningEngagement].filter(
    (value) => value > 0 && value < 55,
  ).length
  const latestThree = records.slice(0, 3)
  const improvingTrend =
    latestThree.length >= 2 &&
    latestThree.filter((record) => record.status === 'present').length >= 2 &&
    latestThree.every((record) => !record.suspicious)

  const riskSignals = {
    lowAttendance: insight.attendancePercentage < 75,
    criticalAttendance: insight.attendancePercentage < 60,
    repeatedAbsenceDay: Boolean(insight.frequentAbsentDay?.count >= 2),
    lowAfternoonEngagement: insight.afternoonEngagement > 0 && insight.afternoonEngagement < 55,
    suspiciousActivity: insight.suspiciousCount > 0,
    lowHonesty: (insight.honestyScore ?? 80) < 65,
    absentStreak: absentStreak >= 2,
  }

  return {
    ...insight,
    absentStreak,
    lowEngagementBuckets,
    improvingTrend,
    riskSignals,
    recentInterventions: db.interventions
      .filter((item) => item.studentId === studentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
  }
}

function createLocalInterventionPlan(context) {
  const actions = []
  const reasons = []

  if (context.riskSignals.criticalAttendance) {
    reasons.push('attendance is in the critical zone')
    actions.push('notify-parent', 'schedule-meeting', 'send-warning')
  } else if (context.riskSignals.lowAttendance) {
    reasons.push('attendance is below the 75% threshold')
    actions.push('send-warning', 'notify-parent')
  }

  if (context.riskSignals.lowAfternoonEngagement) {
    reasons.push('afternoon engagement is low')
    actions.push('extra-assignment')
  }

  if (context.riskSignals.suspiciousActivity) {
    reasons.push('suspicious attendance events were detected')
    actions.push('schedule-meeting')
  }

  if (context.riskSignals.absentStreak || context.riskSignals.repeatedAbsenceDay) {
    reasons.push('absence pattern is repeating')
    actions.push('notify-parent')
  }

  if (!actions.length) {
    actions.push('monitor')
  }

  const uniqueActions = [...new Set(actions)]
  const recommendedAction = uniqueActions[0]
  const urgency = context.riskSignals.criticalAttendance || context.riskSignals.suspiciousActivity ? 'high' : context.riskSignals.lowAttendance ? 'medium' : 'low'
  const summary = context.improvingTrend
    ? 'Student is showing some recent improvement, so a soft intervention is better than a strict escalation right now.'
    : `This student needs intervention because ${reasons.join(', ')}.`

  return {
    recommendedAction,
    actions: uniqueActions,
    urgency,
    summary,
    successHint:
      context.recentInterventions.some((item) => item.outcome === 'improved')
        ? 'Past interventions show improvement after follow-up.'
        : 'No confirmed improvement has been tracked after recent interventions yet.',
    mode: 'local',
  }
}

async function generateInterventionPlan(context) {
  const fallback = createLocalInterventionPlan(context)
  if (!env.openaiApiKey) {
    return fallback
  }

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model: env.openaiModel,
        instructions:
          'You are a teacher-side intervention planner for a student attendance platform. Return strict JSON with keys recommendedAction, actions, urgency, summary, successHint. Actions must use only: send-warning, notify-parent, schedule-meeting, extra-assignment, monitor. Use only the provided context.',
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(context, null, 2) }],
          },
        ],
        max_output_tokens: 220,
      },
      {
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.filter((item) => item.type === 'output_text')
        ?.map((item) => item.text)
        ?.join('\n')

    if (!outputText?.trim()) {
      return fallback
    }

    const parsed = JSON.parse(outputText.trim())
    const allowedActions = ['send-warning', 'notify-parent', 'schedule-meeting', 'extra-assignment', 'monitor']
    const actions = Array.isArray(parsed.actions) ? parsed.actions.filter((item) => allowedActions.includes(item)) : fallback.actions

    return {
      recommendedAction: allowedActions.includes(parsed.recommendedAction) ? parsed.recommendedAction : fallback.recommendedAction,
      actions: actions.length ? [...new Set(actions)] : fallback.actions,
      urgency: ['low', 'medium', 'high'].includes(parsed.urgency) ? parsed.urgency : fallback.urgency,
      summary: String(parsed.summary || fallback.summary),
      successHint: String(parsed.successHint || fallback.successHint),
      mode: 'openai',
    }
  } catch (error) {
    console.warn('Intervention planning fallback triggered:', error.response?.data?.error?.message || error.message)
    return fallback
  }
}

function buildInterventionAnalytics(db) {
  const interventions = db.interventions || []
  const actionBreakdown = interventions.reduce((summary, item) => {
    summary[item.actionType] = (summary[item.actionType] || 0) + 1
    return summary
  }, {})
  const improvedCount = interventions.filter((item) => item.outcome === 'improved').length
  const successRate = interventions.length ? Math.round((improvedCount / interventions.length) * 100) : 0

  return {
    total: interventions.length,
    successRate,
    actionBreakdown,
    recent: interventions
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8),
  }
}

function createLocalAssistantReply(context, message, language = 'en') {
  const selectedLanguage = normalizeAssistantLanguage(language)
  const question = String(message || '').toLowerCase().trim()
  const greetingPattern = /^(hi+|hello+|hey+|hii+|helo+|namaste|namaskar|hy+|yo|bonjour|salut)\b/
  const thanksPattern = /\b(thanks|thank you|thx|shukriya|dhanyavaad|merci)\b/
  const isGreeting = greetingPattern.test(question)
  const isThanksOnly = thanksPattern.test(question) && question.split(/\s+/).length <= 4

  const say = (key, values = {}) => {
    const lines = {
      thanksTeacher: {
        en: 'Happy to help. You can ask about student summaries, suspicious alerts, or parent notifications.',
        hinglish: 'Khushi hui help karke. Aap student summaries, suspicious alerts, ya parent notifications ke baare me pooch sakte ho.',
        hi: 'मदद करके खुशी हुई। आप student summaries, suspicious alerts या parent notifications के बारे में पूछ सकते हैं।',
        mr: 'मदत करून आनंद झाला. तुम्ही student summaries, suspicious alerts किंवा parent notifications बद्दल विचारू शकता.',
        fr: 'Heureux d’aider. Vous pouvez demander les student summaries, suspicious alerts ou parent notifications.',
      },
      thanksStudent: {
        en: 'Happy to help. You can ask about attendance, latest check-in, calendar events, or proofs.',
        hinglish: 'Khushi hui help karke. Aap attendance, latest check-in, calendar events, ya proofs ke baare me pooch sakte ho.',
        hi: 'मदद करके खुशी हुई। आप attendance, latest check-in, calendar events या proofs के बारे में पूछ सकते हैं।',
        mr: 'मदत करून आनंद झाला. तुम्ही attendance, latest check-in, calendar events किंवा proofs बद्दल विचारू शकता.',
        fr: 'Heureux d’aider. Vous pouvez demander votre attendance, le dernier check-in, les calendar events ou les proofs.',
      },
      studentGreeting: {
        en: 'Hello. I am the VisionOS assistant. I can help with your attendance, latest check-in, calendar events, attendance proofs, and low-attendance reasons.',
        hinglish: 'Hello. Main VisionOS assistant hoon. Main aapki attendance, latest check-in, calendar events, attendance proofs, aur low-attendance reasons me help kar sakta hoon.',
        hi: 'नमस्ते। मैं VisionOS assistant हूँ। मैं आपकी attendance, latest check-in, calendar events, attendance proofs और low-attendance reasons में मदद कर सकता हूँ।',
        mr: 'नमस्कार. मी VisionOS assistant आहे. मी तुमची attendance, latest check-in, calendar events, attendance proofs आणि low-attendance reasons समजावू शकतो.',
        fr: 'Bonjour. Je suis l’assistant VisionOS. Je peux aider avec votre attendance, votre dernier check-in, les calendar events, les attendance proofs et les low-attendance reasons.',
      },
      teacherGreeting: {
        en: 'Hello. I am the VisionOS teacher assistant. I can help with dashboard summaries, low-attendance students, suspicious activity, parent alerts, and upcoming events.',
        hinglish: 'Hello. Main VisionOS teacher assistant hoon. Main dashboard summary, low-attendance students, suspicious activity, parent alerts, aur upcoming events me help kar sakta hoon.',
        hi: 'नमस्ते। मैं VisionOS teacher assistant हूँ। मैं dashboard summary, low-attendance students, suspicious activity, parent alerts और upcoming events में मदद कर सकता हूँ।',
        mr: 'नमस्कार. मी VisionOS teacher assistant आहे. मी dashboard summary, low-attendance students, suspicious activity, parent alerts आणि upcoming events मध्ये मदत करू शकतो.',
        fr: 'Bonjour. Je suis l’assistant VisionOS pour teachers. Je peux aider avec le dashboard summary, les low-attendance students, la suspicious activity, les parent alerts et les upcoming events.',
      },
      noAttendance: {
        en: 'No attendance record has been saved yet.',
        hinglish: 'Abhi tak koi attendance record save nahi hai.',
        hi: 'अभी तक कोई attendance record save नहीं है।',
        mr: 'अजून कोणताही attendance record save झालेला नाही.',
        fr: 'Aucun attendance record n’a encore été enregistré.',
      },
      noSchedule: {
        en: 'Detailed upcoming holiday or exam data is not available in the system right now.',
        hinglish: 'Abhi system me detailed upcoming holiday ya exam record available nahi hai.',
        hi: 'System में अभी detailed upcoming holiday या exam record उपलब्ध नहीं है।',
        mr: 'System मध्ये सध्या detailed upcoming holiday किंवा exam record उपलब्ध नाही.',
        fr: 'Le système ne contient pas encore de détail complet sur les prochains holidays ou exams.',
      },
    }
    return (lines[key]?.[selectedLanguage] || lines[key]?.en || '').replace(/\{(\w+)\}/g, (_, token) => values[token] ?? '')
  }

  if (isThanksOnly) {
    return context.role === 'teacher'
      ? say('thanksTeacher')
      : say('thanksStudent')
  }

  if (context.role === 'student') {
    const latest = context.latestRecord
    const latestLine = latest
      ? selectedLanguage === 'en'
        ? `Latest attendance was ${latest.status} on ${latest.date} at ${latest.time}.`
        : selectedLanguage === 'fr'
          ? `La dernière attendance était ${latest.status} le ${latest.date} à ${latest.time}.`
          : `Latest attendance ${latest.status} thi on ${latest.date} at ${latest.time}.`
      : say('noAttendance')
    const nextEvent = context.upcomingEvents[0]

    if (isGreeting) {
      return say('studentGreeting')
    }

    if (question.includes('attendance') || question.includes('present') || question.includes('percentage') || question.includes('presence') || question.includes('présence')) {
      return selectedLanguage === 'en'
        ? `Your attendance is ${context.attendancePercentage}%. Present ${context.presentCount} and absent ${context.absentCount} entries are recorded. ${latestLine}`
        : selectedLanguage === 'fr'
          ? `Votre attendance est de ${context.attendancePercentage}%. ${context.presentCount} entrées present et ${context.absentCount} entrées absent sont enregistrées. ${latestLine}`
          : `Aapki attendance ${context.attendancePercentage}% hai. Present ${context.presentCount} aur absent ${context.absentCount} entries recorded hain. ${latestLine}`
    }

    if (question.includes('low') || question.includes('kyun') || question.includes('why') || question.includes('pourquoi')) {
      return selectedLanguage === 'en'
        ? `Your attendance is ${context.attendancePercentage}%, so a low-attendance alert can trigger if it stays below 75%. Absent ${context.absentCount} and suspicious ${context.suspiciousCount} entries also affect it. Suggestion: use regular live check-in and mark attendance inside the geo-fence.`
        : selectedLanguage === 'fr'
          ? `Votre attendance est de ${context.attendancePercentage}%, donc une alerte low-attendance peut être déclenchée si elle reste sous 75%. Les entrées absent ${context.absentCount} et suspicious ${context.suspiciousCount} comptent aussi.`
          : `Aapki attendance ${context.attendancePercentage}% hai, isliye low-attendance alert trigger ho sakta hai agar yeh 75% se neeche rahe. Absent ${context.absentCount} aur suspicious ${context.suspiciousCount} entries bhi count hoti hain. Suggestion: regular live check-in use karo aur geo-fence ke andar attendance mark karo.`
    }

    if (question.includes('schedule') || question.includes('kal') || question.includes('tomorrow') || question.includes('event') || question.includes('demain') || question.includes('agenda')) {
      if (nextEvent) {
        return selectedLanguage === 'en'
          ? `The next academic item is ${nextEvent.title} on ${nextEvent.date}${nextEvent.time ? ` at ${nextEvent.time}` : ''}. The exact class timetable is not stored in the backend yet.`
          : selectedLanguage === 'fr'
            ? `Le prochain academic item est ${nextEvent.title} le ${nextEvent.date}${nextEvent.time ? ` à ${nextEvent.time}` : ''}. L’horaire exact des cours n’est pas encore stocké dans le backend.`
            : `Next academic item ${nextEvent.date} ko ${nextEvent.title} hai${nextEvent.time ? ` at ${nextEvent.time}` : ''}. Exact class timetable abhi backend me stored nahi hai.`
      }
      return say('noSchedule')
    }

    return selectedLanguage === 'en'
      ? `You are using the student dashboard. Attendance ${context.attendancePercentage}%, present ${context.presentCount}, absent ${context.absentCount}, suspicious ${context.suspiciousCount}. ${latestLine}`
      : selectedLanguage === 'fr'
        ? `Vous utilisez le student dashboard. Attendance ${context.attendancePercentage}%, present ${context.presentCount}, absent ${context.absentCount}, suspicious ${context.suspiciousCount}. ${latestLine}`
        : `Aap student dashboard use kar rahi ho. Attendance ${context.attendancePercentage}% hai, present ${context.presentCount}, absent ${context.absentCount}, suspicious ${context.suspiciousCount}. ${latestLine}`
  }

  const latestRecord = context.recentRecords?.[0]
  if (isGreeting) {
    return say('teacherGreeting')
  }

  if (question.includes('student') || question.includes('summary') || question.includes('dashboard') || question.includes('résumé')) {
    return selectedLanguage === 'en'
      ? `Teacher summary is ready: total students ${context.totalStudents}, total attendance records ${context.totalAttendanceRecords}, low attendance ${context.lowAttendanceCount}, suspicious ${context.suspiciousCount}. Latest record is ${latestRecord?.student?.name || 'N/A'} with status ${latestRecord?.status || 'N/A'}.`
      : selectedLanguage === 'fr'
        ? `Le teacher summary est prêt : total students ${context.totalStudents}, total attendance records ${context.totalAttendanceRecords}, low attendance ${context.lowAttendanceCount}, suspicious ${context.suspiciousCount}. Le latest record est ${latestRecord?.student?.name || 'N/A'} avec le statut ${latestRecord?.status || 'N/A'}.`
        : `Teacher summary ready hai: total students ${context.totalStudents}, total attendance records ${context.totalAttendanceRecords}, low attendance ${context.lowAttendanceCount}, suspicious ${context.suspiciousCount}. Latest record ${latestRecord?.student?.name || 'N/A'} ka ${latestRecord?.status || 'N/A'} hai.`
  }

  if (question.includes('alert') || question.includes('parent') || question.includes('proxy') || question.includes('alerte')) {
    return selectedLanguage === 'en'
      ? `Recent parent and proxy alerts are available. The suspicious count is ${context.suspiciousCount}, and recent alerts are visible on the teacher dashboard. Suggestion: review flagged students and check parent notification logs.`
      : selectedLanguage === 'fr'
        ? `Les parent et proxy alerts récentes sont disponibles. Le suspicious count est ${context.suspiciousCount} et les recent alerts sont visibles sur le teacher dashboard.`
        : `Recent parent aur proxy alerts available hain. Suspicious count ${context.suspiciousCount} hai aur recent alerts teacher dashboard par visible hain. Suggestion: flagged students ko review karke parent notification logs check karo.`
  }

  return selectedLanguage === 'en'
    ? `Teacher assistant is ready. Total students ${context.totalStudents}, low attendance ${context.lowAttendanceCount}, suspicious ${context.suspiciousCount}, total attendance records ${context.totalAttendanceRecords}.`
    : selectedLanguage === 'fr'
      ? `L’assistant teacher est prêt. Total students ${context.totalStudents}, low attendance ${context.lowAttendanceCount}, suspicious ${context.suspiciousCount}, total attendance records ${context.totalAttendanceRecords}.`
      : `Teacher assistant ready hai. Total students ${context.totalStudents}, low attendance ${context.lowAttendanceCount}, suspicious ${context.suspiciousCount}, total attendance records ${context.totalAttendanceRecords}.`
}

async function generateAssistantResponse({ context, message, history = [], language = 'en' }) {
  if (!env.openaiApiKey) {
    return { answer: createLocalAssistantReply(context, message, language), mode: 'local' }
  }

  const prompt = buildAssistantPrompt(context, message, history, language)

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model: env.openaiModel,
        instructions: prompt.instructions,
        input: prompt.input,
        max_output_tokens: 350,
      },
      {
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.filter((item) => item.type === 'output_text')
        ?.map((item) => item.text)
        ?.join('\n')

    if (outputText?.trim()) {
      return { answer: outputText.trim(), mode: 'openai' }
    }
  } catch (error) {
    console.warn('OpenAI assistant fallback triggered:', error.response?.data?.error?.message || error.message)
  }

  return { answer: createLocalAssistantReply(context, message, language), mode: 'local' }
}

function cleanupOtpChallenges(db) {
  const now = Date.now()
  db.otpChallenges = (db.otpChallenges || []).filter((challenge) => !challenge.usedAt && new Date(challenge.expiresAt).getTime() > now)
}

async function createOtpChallenge(db, { user, purpose, email, meta = {} }) {
  cleanupOtpChallenges(db)
  const otpCode = generateOtpCode()
  const challenge = {
    id: createId('otp'),
    userId: user.id,
    purpose,
    email: email || user.email,
    otpCode,
    meta,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    usedAt: null,
  }

  db.otpChallenges.unshift(challenge)

  const subject = purpose === 'attendance' ? 'Attendance OTP Verification Code' : 'Login OTP Verification Code'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${subject}</h2>
      <p>Hello ${user.name},</p>
      <p>Your OTP code is:</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.25em; margin: 18px 0;">${otpCode}</div>
      <p>This code will expire in 10 minutes.</p>
    </div>
  `
  const delivery = await dispatchEmail({
    to: challenge.email,
    subject,
    html,
    text: `${subject}: ${otpCode}. This code expires in 10 minutes.`,
  })

  challenge.deliveryStatus = delivery.status
  challenge.deliveryDetail = delivery.detail
  return challenge
}

function verifyOtpChallenge(db, { userId, challengeId, otpCode, purpose }) {
  cleanupOtpChallenges(db)
  const challenge = (db.otpChallenges || []).find(
    (item) => item.id === challengeId && item.userId === userId && item.purpose === purpose && !item.usedAt,
  )
  if (!challenge) {
    return { ok: false, message: 'OTP challenge not found or expired.' }
  }
  if (challenge.otpCode !== String(otpCode || '').trim()) {
    return { ok: false, message: 'Invalid OTP code.' }
  }
  challenge.usedAt = new Date().toISOString()
  return { ok: true, challenge }
}

function verifyAttendanceOtpChallenge(db, { userId, challengeId, otpCode }) {
  const attendanceResult = verifyOtpChallenge(db, {
    userId,
    challengeId,
    otpCode,
    purpose: 'attendance',
  })

  if (attendanceResult.ok) {
    return attendanceResult
  }

  const loginResult = verifyOtpChallenge(db, {
    userId,
    challengeId,
    otpCode,
    purpose: 'login',
  })

  if (loginResult.ok) {
    return {
      ok: true,
      challenge: loginResult.challenge,
      reusedLoginOtp: true,
    }
  }

  cleanupOtpChallenges(db)
  const normalizedCode = String(otpCode || '').trim()
  const fallbackChallenge = (db.otpChallenges || [])
    .filter(
      (item) =>
        item.userId === userId &&
        !item.usedAt &&
        ['attendance', 'login'].includes(item.purpose) &&
        String(item.otpCode || '').trim() === normalizedCode,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  if (fallbackChallenge) {
    fallbackChallenge.usedAt = new Date().toISOString()
    return {
      ok: true,
      challenge: fallbackChallenge,
      fallbackMatchedByCode: true,
    }
  }

  return attendanceResult
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function distanceBetweenGps(pointA, pointB) {
  if (!pointA?.latitude || !pointA?.longitude || !pointB?.latitude || !pointB?.longitude) return null
  const earthRadiusKm = 6371
  const deltaLat = toRadians(pointB.latitude - pointA.latitude)
  const deltaLon = toRadians(pointB.longitude - pointA.longitude)
  const latA = toRadians(pointA.latitude)
  const latB = toRadians(pointB.latitude)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function collectLatestStudentEvent(studentId, attendance) {
  return attendance
    .filter((record) => record.studentId === studentId)
    .flatMap((record) => (record.scanEvents?.length ? record.scanEvents : [{ createdAt: record.createdAt, gps: record.gps, locationLabel: record.locationLabel }]))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
}

function detectSuspiciousAttendance({ student, db, now, gps, locationLabel }) {
  const flags = []
  const currentHour = now.getHours()
  if (currentHour < 5 || currentHour >= 23) {
    flags.push({
      code: 'time-anomaly',
      label: 'Time anomaly',
      detail: 'Attendance marked at an unusual hour.',
      severity: 'medium',
    })
  }

  const latestEvent = collectLatestStudentEvent(student.id, db.attendance)
  if (latestEvent?.gps && gps?.latitude && gps?.longitude) {
    const distanceKm = distanceBetweenGps(latestEvent.gps, gps)
    const minutesGap = Math.abs((now - new Date(latestEvent.createdAt)) / (1000 * 60))
    if (distanceKm !== null && minutesGap <= 120 && distanceKm > 1.5) {
      flags.push({
        code: 'location-mismatch',
        label: 'Location mismatch',
        detail: `Same student detected ${distanceKm.toFixed(1)} km away within ${Math.round(minutesGap)} minutes.`,
        severity: 'high',
      })
    }
  }

  if (latestEvent?.createdAt) {
    const minutesGap = Math.abs((now - new Date(latestEvent.createdAt)) / (1000 * 60))
    if (minutesGap <= 1) {
      flags.push({
        code: 'rapid-repeat',
        label: 'Rapid repeat',
        detail: 'Attendance was marked again within a very short interval.',
        severity: 'medium',
      })
    }
  }

  return {
    suspicious: flags.length > 0,
    flags,
    score: flags.reduce((total, flag) => total + (flag.severity === 'high' ? 50 : 25), 0),
    locationLabel: locationLabel || 'Unknown location',
  }
}

function evaluateGeoFence(gps, db = null) {
  const zone = getGeoFenceZone(db)
  if (!gps?.latitude || !gps?.longitude) {
    return {
      allowed: false,
      message: 'Location access required for geo-fenced attendance.',
      distanceMeters: null,
      zone,
    }
  }
  const distanceKm = distanceBetweenGps(gps, zone)
  const distanceMeters = distanceKm === null ? null : Math.round(distanceKm * 1000)
  const accuracyMeters = Number.isFinite(gps?.accuracyMeters) ? Math.round(gps.accuracyMeters) : null
  const effectiveRadiusMeters = zone.radiusMeters + Math.min(accuracyMeters || 0, 350)
  if (distanceMeters === null || distanceMeters > effectiveRadiusMeters) {
    return {
      allowed: false,
      message: 'You are outside authorized area.',
      distanceMeters,
      accuracyMeters,
      effectiveRadiusMeters,
      zone,
    }
  }
  return {
    allowed: true,
    message: 'Inside authorized campus zone.',
    distanceMeters,
    accuracyMeters,
    effectiveRadiusMeters,
    zone,
  }
}

function createAbsentAttendanceRecord({ db, student, now, locationLabel, gps, geoFence, reason, image }) {
  const indiaNow = getIndiaDateTimeParts(now)
  const date = indiaNow.date
  const time = indiaNow.time
  const record = {
    id: createId('att'),
    studentId: student.id,
    date,
    time,
    status: 'absent',
    method: gps?.latitude ? 'geo-fence-blocked' : 'location-missing',
    confidence: 0,
    emotionState: 'pending',
    engagementScore: 0,
    proofImage: image || null,
    proofCapturedAt: now.toISOString(),
    locationLabel: locationLabel || 'Student Live Check-in',
    gps: gps?.latitude && gps?.longitude ? gps : null,
    geoFenceStatus: geoFence,
    absentReason: reason,
    justification: null,
    suspicious: false,
    suspiciousFlags: [],
    suspiciousScore: 0,
    scanEvents: [
      {
        createdAt: now.toISOString(),
        gps: gps?.latitude && gps?.longitude ? gps : null,
        locationLabel: locationLabel || 'Student Live Check-in',
        blocked: true,
        reason,
      },
    ],
    createdAt: now.toISOString(),
  }
  db.attendance.push(record)

  return record
}

async function syncFaceProfile(student, db = null) {
  const sourceDb = db || readDb()
  const sampleImages = (student?.faceSamples || []).map((sample) => sample.imageUrl).filter(Boolean)
  const proofImages = [...(sourceDb.attendance || []), ...(sourceDb.teacherAttendance || [])]
    .filter((record) => (record.studentId === student?.id || record.teacherId === student?.id) && record.proofImage)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map((record) => record.proofImage)
    .filter(Boolean)
  const images = [...new Set([...sampleImages, ...proofImages])].slice(0, 10)
  if (!images.length) return
  try {
    await axios.post(`${env.faceApiUrl}/register-face`, {
      userId: student.id,
      name: student.name,
      email: student.email,
      role: student.role,
      images,
    })
  } catch (error) {
    console.warn('Unable to sync face profile:', error.message)
  }
}

function findStudentFromRecognition(db, recognitionData) {
  if (!recognitionData) return null

  let student = db.users.find((user) => user.id === recognitionData.userId && user.role === 'student')
  if (student) return student

  if (recognitionData?.email) {
    student = db.users.find((user) => user.email === String(recognitionData.email).toLowerCase() && user.role === 'student')
  }

  return student || null
}

async function resolveTeacherScannerStudent(db, image, initialRecognitionData) {
  const directlyMatchedStudent = findStudentFromRecognition(db, initialRecognitionData)
  if (directlyMatchedStudent) {
    return {
      student: directlyMatchedStudent,
      recognitionData: initialRecognitionData,
      resolvedBy: 'direct',
    }
  }

  const candidates = db.users.filter((user) => user.role === 'student' && user.faceRegistered)
  if (!candidates.length) {
    return { student: null, recognitionData: initialRecognitionData, resolvedBy: 'none' }
  }

  const strictMatches = await Promise.all(
    candidates.map(async (candidate) => {
      await syncFaceProfile(candidate, db)
      const { data } = await axios.post(`${env.faceApiUrl}/recognize-face`, {
        image,
        expectedUserId: candidate.id,
        expectedEmail: candidate.email,
        strictExpected: true,
      })

      return {
        candidate,
        matched: Boolean(data?.matched),
        confidence: Number(data?.confidence || 0),
        data,
      }
    }),
  )

  const bestMatch = strictMatches
    .filter((item) => item.matched)
    .sort((a, b) => b.confidence - a.confidence)[0]

  if (!bestMatch) {
    return { student: null, recognitionData: initialRecognitionData, resolvedBy: 'none' }
  }

  return {
    student: bestMatch.candidate,
    recognitionData: {
      ...bestMatch.data,
      userId: bestMatch.candidate.id,
      email: bestMatch.candidate.email,
      name: bestMatch.candidate.name,
    },
    resolvedBy: 'strict-fallback',
  }
}

async function bootstrapStudentFaceProfile(student, image, db = null) {
  const sourceDb = db || readDb()
  const proofImages = (sourceDb.attendance || [])
    .filter((record) => record.studentId === student?.id && record.proofImage)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)
    .map((record) => record.proofImage)
    .filter(Boolean)
  const faceSamples = (student?.faceSamples || []).map((sample) => sample.imageUrl).filter(Boolean)
  const bootstrapImages = [image, image, ...faceSamples, ...proofImages].filter(Boolean).slice(0, 8)
  if (!bootstrapImages.length) {
    throw new Error('No face image available to bootstrap the student dataset.')
  }

  const response = await axios.post(`${env.faceApiUrl}/register-face`, {
    userId: student.id,
    name: student.name,
    email: student.email,
    role: student.role,
    images: bootstrapImages,
  })

  if (response.data?.success) {
    student.faceRegistered = true
    student.faceSamples = bootstrapImages.map((imageUrl) => ({ imageUrl, capturedAt: new Date().toISOString() }))
  }

  return response.data
}

function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ message: 'Authentication required.' })
    const payload = jwt.verify(token, env.jwtSecret)
    if (payload.role === 'admin' && payload.email === env.adminEmail) {
      req.user = {
        id: 'admin-root',
        name: 'Super Admin',
        email: env.adminEmail,
        role: 'admin',
        department: 'Administration',
        avatar: 'SA',
      }
      return next()
    }
    const db = readDb()
    const user = db.users.find((item) => item.id === payload.userId)
    if (!user) return res.status(401).json({ message: 'User not found.' })
    req.user = sanitizeUser(user)
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to perform this action.' })
    }
    next()
  }
}

const app = express()
app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(express.json({ limit: '25mb' }))
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  const db = readDb()
  res.json({ status: 'ok', message: 'Node attendance backend is live.', users: db.users.length, attendance: db.attendance.length })
})

app.get('/api/system/geo-fence', authMiddleware, (req, res) => {
  return res.json({ zone: AUTHORIZED_ZONE })
})

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, department, preferredLanguage, themePreference, faceImages = [], parentName, parentEmail, parentPhone } = req.body
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' })
    }
    if (role !== 'student') {
      return res.status(400).json({ message: 'Only student self-signup is allowed. Teacher accounts are created by admin only.' })
    }

    const db = readDb()
    const exists = db.users.find((user) => user.email === email.toLowerCase())
    if (exists) return res.status(409).json({ message: 'Email is already registered.' })

    const user = {
      id: createId('user'),
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role,
      department: department || 'General',
      preferredLanguage: preferredLanguage || 'en',
      themePreference: themePreference || 'dark',
      studentCode: role === 'student' ? `STU-${Date.now().toString().slice(-6)}` : '',
      avatar: name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join(''),
      faceRegistered: false,
      faceSamples: [],
      attendancePercentage: 0,
      honestyScore: 80,
      parentContact: role === 'student'
        ? {
            name: parentName || '',
            email: parentEmail?.toLowerCase() || '',
            phone: parentPhone || '',
          }
        : null,
      createdAt: new Date().toISOString(),
    }

    if (role === 'student' && faceImages.length) {
      const response = await axios.post(`${env.faceApiUrl}/register-face`, {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        images: faceImages,
      })
      user.faceRegistered = Boolean(response.data?.success)
      user.faceSamples = faceImages.map((imageUrl) => ({ imageUrl, capturedAt: new Date().toISOString() }))
    }

    db.users.push(user)
    writeDb(db)
    const token = signToken(user)
    return res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (error) {
    const status = error.response?.status || 500
    const message = error.response?.data?.message || 'Signup failed.'
    return res.status(status).json({
      message,
      detail: error.response?.data?.detail || error.message,
      ownerEmail: error.response?.data?.ownerEmail || '',
      ownerName: error.response?.data?.ownerName || '',
      confidence: error.response?.data?.confidence || null,
    })
  }
})

app.post('/api/admin/teachers', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, email, password, department = 'General' } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Teacher name, email, and password are required.' })
    }

    const db = readDb()
    if (db.users.some((user) => user.email === email.toLowerCase())) {
      return res.status(409).json({ message: 'Teacher email already exists.' })
    }

    const teacher = {
      id: createId('user'),
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: 'teacher',
      department,
      preferredLanguage: 'en',
      themePreference: 'dark',
      studentCode: '',
      avatar: name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join(''),
      faceRegistered: false,
      faceSamples: [],
      attendancePercentage: 0,
      honestyScore: 80,
      parentContact: null,
      createdAt: new Date().toISOString(),
    }

    db.users.push(teacher)
    writeDb(db)

    return res.json({
      success: true,
      teacher: sanitizeUser(teacher),
      message: 'Teacher account created successfully. Teacher can now login with this email.',
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create teacher account.', detail: error.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password, parentEmail, parentName, parentPhone, role, otpCode, otpChallengeId, faceImage } = req.body
  if (role === 'admin') {
    if (String(email || '').toLowerCase() !== env.adminEmail.toLowerCase() || password !== env.adminPassword) {
      return res.status(401).json({ message: 'Invalid admin credentials.' })
    }
    return res.json({
      token: jwt.sign({ userId: 'admin-root', role: 'admin', email: env.adminEmail }, env.jwtSecret, { expiresIn: '7d' }),
      user: {
        id: 'admin-root',
        name: 'Super Admin',
        email: env.adminEmail,
        role: 'admin',
        department: 'Administration',
        avatar: 'SA',
      },
    })
  }
  const db = readDb()
  const user = db.users.find((item) => item.email === email?.toLowerCase())
  if (!user) return res.status(401).json({ message: 'Invalid credentials.' })
  if (role && user.role !== role) return res.status(401).json({ message: 'Selected role does not match this account.' })
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ message: 'Invalid credentials.' })

  if (!otpCode || !otpChallengeId) {
    const challenge = await createOtpChallenge(db, {
      user,
      purpose: 'login',
      email: user.email,
      meta: { role, parentEmail, parentName, parentPhone },
    })
    writeDb(db)
    return res.json({
      otpRequired: true,
      challengeId: challenge.id,
      deliveryStatus: challenge.deliveryStatus,
      faceRequired: Boolean(user.role === 'student' && user.faceRegistered && user.faceSamples?.length),
      message: `OTP sent to ${challenge.email}.`,
    })
  }

  const verified = verifyOtpChallenge(db, {
    userId: user.id,
    challengeId: otpChallengeId,
    otpCode,
    purpose: 'login',
  })
  if (!verified.ok) {
    writeDb(db)
    return res.status(401).json({ message: verified.message })
  }

  if (user.role === 'student' && user.faceRegistered && user.faceSamples?.length) {
    if (!faceImage) {
      writeDb(db)
      return res.status(403).json({ message: 'Face verification is required to complete student login.' })
    }

    try {
      await syncFaceProfile(user, db)
      const [generalRecognition, strictRecognition] = await Promise.all([
        axios.post(`${env.faceApiUrl}/recognize-face`, { image: faceImage }),
        axios.post(`${env.faceApiUrl}/recognize-face`, {
          image: faceImage,
          expectedUserId: user.id,
          expectedEmail: user.email,
          strictExpected: true,
        }),
      ])

      if (!strictRecognition.data?.matched || strictRecognition.data?.userId !== user.id) {
        if (generalRecognition.data?.matched && generalRecognition.data?.userId && generalRecognition.data.userId !== user.id) {
          writeDb(db)
          return res.status(403).json({ message: 'Login blocked. This face belongs to another registered student account.' })
        }
        writeDb(db)
        return res.status(403).json({ message: 'Face verification failed for this student account.' })
      }
    } catch (error) {
      writeDb(db)
      return res.status(503).json({ message: 'Face verification service is unavailable right now.', detail: error.message })
    }
  }

  if (role === 'student' && user.role === 'student') {
    user.parentContact = {
      name: parentName || user.parentContact?.name || '',
      email: parentEmail?.toLowerCase() || user.parentContact?.email || '',
      phone: parentPhone || user.parentContact?.phone || '',
    }
    writeDb(db)
  }
  return res.json({ token: signToken(user), user: sanitizeUser(user) })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user })
})

app.post('/api/teachers/me/register-face', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const { faceImages = [] } = req.body
    if (!Array.isArray(faceImages) || faceImages.length < 3) {
      return res.status(400).json({ message: 'At least 3 teacher face samples are required.' })
    }

    const db = readDb()
    const teacher = db.users.find((user) => user.id === req.user.id && user.role === 'teacher')
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher account not found.' })
    }

    const response = await axios.post(`${env.faceApiUrl}/register-face`, {
      userId: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
      images: faceImages,
    })

    teacher.faceRegistered = Boolean(response.data?.success)
    teacher.faceSamples = faceImages.map((imageUrl) => ({ imageUrl, capturedAt: new Date().toISOString() }))
    writeDb(db)
    return res.json({ success: true, teacher: sanitizeUser(teacher), message: 'Teacher face profile registered successfully.' })
  } catch (error) {
    const message = error.response?.data?.message || 'Unable to register teacher face.'
    return res.status(error.response?.status || 500).json({
      message,
      detail: error.response?.data?.detail || error.message,
      ownerEmail: error.response?.data?.ownerEmail || '',
      ownerName: error.response?.data?.ownerName || '',
      ownerRole: error.response?.data?.ownerRole || '',
      confidence: error.response?.data?.confidence || null,
    })
  }
})

app.get('/api/students', authMiddleware, roleMiddleware('teacher', 'admin'), (req, res) => {
  const db = readDb()
  const students = db.users.filter((user) => user.role === 'student').map(sanitizeUser).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return res.json({ students })
})

app.get('/api/students/:id/summary', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  try {
    const db = readDb()
    if (reconcileDailyAttendanceForUsers(db, [req.params.id])) {
      writeDb(db)
    }

    const context = buildStudentInterventionContext(db, req.params.id)
    if (!context) {
      return res.status(404).json({ message: 'Student not found.' })
    }

    const [{ report, mode }, intervention] = await Promise.all([
      generateStudentInsightReport(context),
      generateInterventionPlan(context),
    ])

    return res.json({
      student: context.student,
      report,
      mode,
      context,
      intervention,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to generate student summary.', detail: error.message })
  }
})

app.post('/api/students', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  try {
    const { name, email, password, department, faceImages = [], parentName, parentEmail, parentPhone } = req.body
    const db = readDb()
    if (db.users.some((user) => user.email === email.toLowerCase())) {
      return res.status(409).json({ message: 'Student email already exists.' })
    }
    const student = {
      id: createId('user'),
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: 'student',
      department: department || 'General',
      preferredLanguage: 'en',
      themePreference: 'dark',
      studentCode: `STU-${Date.now().toString().slice(-6)}`,
      avatar: name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join(''),
      faceRegistered: false,
      faceSamples: [],
      attendancePercentage: 0,
      honestyScore: 80,
      parentContact: {
        name: parentName || '',
        email: parentEmail?.toLowerCase() || '',
        phone: parentPhone || '',
      },
      createdAt: new Date().toISOString(),
    }

    if (faceImages.length) {
      const response = await axios.post(`${env.faceApiUrl}/register-face`, {
        userId: student.id,
        name: student.name,
        email: student.email,
        role: student.role,
        images: faceImages,
      })
      student.faceRegistered = Boolean(response.data?.success)
      student.faceSamples = faceImages.map((imageUrl) => ({ imageUrl, capturedAt: new Date().toISOString() }))
    }

    db.users.push(student)
    writeDb(db)
    return res.status(201).json({ student: sanitizeUser(student) })
  } catch (error) {
    const status = error.response?.status || 500
    const message = error.response?.data?.message || 'Unable to create student.'
    return res.status(status).json({
      message,
      detail: error.response?.data?.detail || error.message,
      ownerEmail: error.response?.data?.ownerEmail || '',
      ownerName: error.response?.data?.ownerName || '',
      confidence: error.response?.data?.confidence || null,
    })
  }
})

app.delete('/api/students/:id', authMiddleware, roleMiddleware('teacher', 'admin'), (req, res) => {
  const db = readDb()
  db.users = db.users.filter((user) => user.id !== req.params.id)
  db.attendance = db.attendance.filter((record) => record.studentId !== req.params.id)
  db.interventions = (db.interventions || []).filter((item) => item.studentId !== req.params.id)
  writeDb(db)
  return res.json({ message: 'Student removed successfully.' })
})

app.post('/api/students/:id/intervention', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  try {
    const { actionType, note = '' } = req.body
    const allowedActions = ['send-warning', 'notify-parent', 'schedule-meeting', 'extra-assignment', 'monitor']
    if (!allowedActions.includes(actionType)) {
      return res.status(400).json({ message: 'Unsupported intervention action.' })
    }

    const db = readDb()
    const student = db.users.find((item) => item.id === req.params.id && item.role === 'student')
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' })
    }

    const context = buildStudentInterventionContext(db, student.id)
    const interventionLog = {
      id: createId('intervention'),
      studentId: student.id,
      studentName: student.name,
      teacherId: req.user.id,
      actionType,
      note: String(note || '').trim(),
      createdAt: new Date().toISOString(),
      attendancePercentage: context?.attendancePercentage || student.attendancePercentage || 0,
      engagementSnapshot: {
        morning: context?.morningEngagement || 0,
        afternoon: context?.afternoonEngagement || 0,
        evening: context?.eveningEngagement || 0,
      },
      outcome: actionType === 'monitor' ? 'monitoring' : (context?.improvingTrend ? 'improved' : 'pending'),
    }

    let delivery = null
    if (actionType === 'send-warning' || actionType === 'notify-parent') {
      delivery = await createParentNotification(db, {
        student,
        type: actionType === 'send-warning' ? 'teacher-warning' : 'teacher-parent-notification',
        title: actionType === 'send-warning' ? 'Teacher warning issued' : 'Teacher intervention notice',
        message:
          actionType === 'send-warning'
            ? `${student.name} has been flagged for attendance follow-up. Current attendance is ${student.attendancePercentage || 0}%. ${note || 'Please review attendance regularly.'}`
            : `${student.name} needs teacher intervention. Current attendance is ${student.attendancePercentage || 0}% and engagement needs review. ${note || 'Parent follow-up has been recommended.'}`,
        attendanceRecord: null,
        skipDedup: true,
      })
    }

    db.interventions.unshift(interventionLog)
    writeDb(db)

    return res.json({
      success: true,
      intervention: interventionLog,
      deliveryStatus: delivery?.deliveryStatus || delivery?.status || null,
      message:
        actionType === 'schedule-meeting'
          ? 'Meeting recommendation saved successfully.'
          : actionType === 'extra-assignment'
            ? 'Extra assignment recommendation saved successfully.'
            : actionType === 'monitor'
              ? 'Monitoring note saved successfully.'
              : 'Intervention action completed successfully.',
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to complete intervention action.', detail: error.message })
  }
})

app.get('/api/students/me/profile', authMiddleware, roleMiddleware('student'), (req, res) => {
  const db = readDb()
  if (reconcileDailyAttendanceForUsers(db, [req.user.id])) {
    writeDb(db)
  }
  const user = db.users.find((item) => item.id === req.user.id)
  const records = db.attendance.filter((record) => record.studentId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = records.filter((record) => record.date === today)
  const engagementToday = todayRecords.length
    ? Math.round(todayRecords.reduce((sum, record) => sum + (record.engagementScore || 0), 0) / todayRecords.length)
    : 0
  return res.json({ student: sanitizeUser(user), records, engagementToday })
})

app.post('/api/attendance/:id/justify', authMiddleware, roleMiddleware('student'), async (req, res) => {
  try {
    const { reason, proofNote = '' } = req.body
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ message: 'Please enter a proper absence reason.' })
    }

    const db = readDb()
    const student = db.users.find((item) => item.id === req.user.id && item.role === 'student')
    if (!student) return res.status(404).json({ message: 'Student account not found.' })

    const record = db.attendance.find((item) => item.id === req.params.id && item.studentId === req.user.id)
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' })
    if (record.status !== 'absent') {
      return res.status(400).json({ message: 'Justification can only be added to absent records.' })
    }

    const previousReasons = getStudentAbsentRecords(student.id, db.attendance)
      .filter((item) => item.id !== record.id)
      .map((item) => item.justification?.reason || item.absentReason || '')
      .filter(Boolean)
      .slice(0, 6)

    const analysis = await analyzeAttendanceJustification({
      reason: String(reason).trim(),
      student,
      previousReasons,
      absentRecord: record,
    })

    record.justification = {
      reason: String(reason).trim(),
      proofNote: String(proofNote || '').trim(),
      aiLabel: analysis.aiLabel,
      aiSummary: analysis.summary,
      patternNote: analysis.patternNote,
      repeatedPattern: analysis.repeatedPattern,
      trustScore: analysis.trustScore,
      confidence: analysis.confidence,
      analyzedBy: analysis.mode,
      submittedAt: new Date().toISOString(),
    }

    student.honestyScore = analysis.trustScore

    await createParentNotification(db, {
      student,
      type: 'absence-justification',
      title: 'Absence reason submitted',
      message: `${student.name} submitted an absence reason for ${record.date}: "${record.justification.reason}". AI review: ${record.justification.aiLabel}. ${record.justification.aiSummary}`,
      attendanceRecord: record,
      skipDedup: true,
    })

    writeDb(db)
    return res.json({
      success: true,
      record,
      honestyScore: student.honestyScore,
      message: 'Absence reason saved and analyzed successfully.',
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to analyze absence reason.', detail: error.message })
  }
})

app.post('/api/attendance/:id/override-present', authMiddleware, roleMiddleware('teacher', 'admin'), (req, res) => {
  const db = readDb()
  const record = db.attendance.find((item) => item.id === req.params.id)
  if (!record) {
    return res.status(404).json({ message: 'Attendance record not found.' })
  }

  const student = db.users.find((user) => user.id === record.studentId && user.role === 'student')
  if (!student) {
    return res.status(404).json({ message: 'Student account not found for this attendance record.' })
  }

  const indiaNow = getIndiaDateTimeParts(new Date())
  record.status = 'present'
  record.method = 'manual-override'
  record.time = record.time || indiaNow.time
  record.absentReason = null
  record.justification = null
  record.withinAttendanceWindow = true
  record.override = {
    correctedById: req.user.id,
    correctedByName: req.user.name,
    correctedByRole: req.user.role,
    correctedAt: new Date().toISOString(),
    note: String(req.body?.note || '').trim(),
    previousStatus: 'absent',
  }

  writeDb(db)
  return res.json({
    message: `Attendance corrected to present for ${student.name}.`,
    record: {
      ...record,
      student: sanitizeUser(student),
    },
  })
})

app.post('/api/students/me/bootstrap-face', authMiddleware, roleMiddleware('student'), async (req, res) => {
  try {
    const { image } = req.body
    if (!image) return res.status(400).json({ message: 'Bootstrap face image is required.' })

    const db = readDb()
    const student = db.users.find((item) => item.id === req.user.id && item.role === 'student')
    if (!student) return res.status(404).json({ message: 'Student account not found.' })

    const data = await bootstrapStudentFaceProfile(student, image, db)
    writeDb(db)
    return res.json({
      success: true,
      samples: data?.samples || student.faceSamples?.length || 0,
      student: sanitizeUser(student),
      message: 'Face dataset prepared for the current student.',
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to prepare the face dataset.', detail: error.message })
  }
})

app.post('/api/attendance/request-otp', authMiddleware, roleMiddleware('student'), async (req, res) => {
  try {
    const db = readDb()
    const student = db.users.find((item) => item.id === req.user.id && item.role === 'student')
    if (!student) return res.status(404).json({ message: 'Student account not found.' })

    const challenge = await createOtpChallenge(db, {
      user: student,
      purpose: 'attendance',
      email: student.email,
    })
    writeDb(db)
    return res.json({
      success: true,
      challengeId: challenge.id,
      deliveryStatus: challenge.deliveryStatus,
      message: `Attendance OTP sent to ${challenge.email}.`,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to send attendance OTP.', detail: error.message })
  }
})

app.get('/api/teacher-attendance/me', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  const db = readDb()
  const teacher = db.users.find((user) => user.id === req.user.id && user.role === 'teacher')
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher account not found.' })
  }

  const records = (db.teacherAttendance || [])
    .filter((record) => record.teacherId === teacher.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return res.json({
    teacher: sanitizeUser(teacher),
    records,
    latestRecord: records[0] || null,
  })
})

app.post('/api/admin/teacher-attendance/override-present', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const { teacherId, date, note = '' } = req.body || {}
  if (!teacherId || !date) {
    return res.status(400).json({ message: 'Teacher and date are required for attendance correction.' })
  }

  const db = readDb()
  const teacher = db.users.find((user) => user.id === teacherId && user.role === 'teacher')
  if (!teacher) {
    return res.status(404).json({ message: 'Teacher account not found.' })
  }

  let record = (db.teacherAttendance || []).find((item) => item.teacherId === teacherId && item.date === date)
  if (!record) {
    record = {
      id: createId('teach_att'),
      teacherId: teacher.id,
      name: teacher.name,
      date,
      time: getIndiaDateTimeParts(new Date()).time,
      status: 'present',
      remark: 'Admin corrected to present',
      late: false,
      location: 'Manual correction',
      locationLabel: 'Admin control panel',
      gps: null,
      geoFenceStatus: null,
      faceMatch: false,
      faceConfidence: 0,
      proofImage: null,
      proofCapturedAt: null,
      createdAt: new Date().toISOString(),
    }
    db.teacherAttendance.push(record)
  } else {
    record.status = 'present'
    record.remark = 'Admin corrected to present'
    record.late = false
    record.location = record.location || 'Manual correction'
    record.locationLabel = 'Admin control panel'
  }

  record.override = {
    correctedById: req.user.id,
    correctedByName: req.user.name,
    correctedByRole: req.user.role,
    correctedAt: new Date().toISOString(),
    note: String(note).trim(),
    previousStatus: 'absent',
  }

  writeDb(db)
  return res.json({
    message: `Teacher attendance corrected to present for ${teacher.name}.`,
    record: {
      ...record,
      teacher: sanitizeUser(teacher),
    },
  })
})

app.post('/api/teacher-attendance/scan', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const { image, gps, locationLabel } = req.body
    if (!image) {
      return res.status(400).json({ message: 'Teacher live webcam image is required.' })
    }

    const db = readDb()
    const teacher = db.users.find((user) => user.id === req.user.id && user.role === 'teacher')
    const attendanceNow = new Date()
    const indiaNow = getIndiaDateTimeParts(attendanceNow)
    const windowStatus = evaluateTeacherAttendanceWindow(attendanceNow, db)
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher account not found.' })
    }
    if (!teacher.faceRegistered || !teacher.faceSamples?.length) {
      return res.status(403).json({ message: 'Teacher face profile not registered yet. Please register your face first.' })
    }

    if (windowStatus.beforeWindow) {
      return res.status(403).json({
        matched: false,
        message: windowStatus.message,
      })
    }

    if (windowStatus.afterWindow) {
      const absentRecord = createAbsentTeacherAttendanceRecord({
        db,
        teacher,
        now: attendanceNow,
        locationLabel: locationLabel || 'Teacher Check-In',
        gps,
        reason: 'Teacher missed the 09:00 AM to 05:00 PM attendance window.',
        image,
      })
      writeDb(db)
      return res.status(403).json({
        matched: false,
        message: windowStatus.message,
        record: absentRecord,
      })
    }

    const geoFence = evaluateGeoFence(gps, db)
    if (!geoFence.allowed) {
      return res.status(403).json({
        matched: false,
        geoFence,
        message: `${geoFence.message} Out of range for ${geoFence.zone.name}.`,
      })
    }

    await syncFaceProfile(teacher, db)

    let recognitionData = null
    try {
      const recognition = await axios.post(`${env.faceApiUrl}/recognize-face`, {
        image,
        expectedUserId: teacher.id,
        expectedEmail: teacher.email,
        strictExpected: true,
      })
      recognitionData = recognition.data
    } catch (error) {
      const upstreamStatus = error.response?.status
      const upstreamMessage = error.response?.data?.message || error.response?.data?.detail || error.message
      const upstreamDetail = error.response?.data?.detail || ''

      if (upstreamStatus && upstreamStatus < 500) {
        return res.status(upstreamStatus).json({
          matched: false,
          message: upstreamMessage,
          detail: upstreamDetail,
        })
      }

      return res.status(503).json({
        matched: false,
        message: 'Teacher face verification service is unavailable right now.',
        detail: upstreamMessage,
      })
    }

    if (!recognitionData?.matched || recognitionData?.userId !== teacher.id) {
      return res.status(403).json({ matched: false, message: 'Face verification failed for this teacher account.' })
    }

    const now = attendanceNow
    const date = indiaNow.date
    const time = indiaNow.time
    const late = isTeacherLate(now)
    let record = (db.teacherAttendance || []).find((item) => item.teacherId === teacher.id && item.date === date)

    if (!record) {
      record = {
        id: createId('teach_att'),
        teacherId: teacher.id,
        name: teacher.name,
        date,
        time,
        status: 'present',
        remark: late ? 'Late Entry' : 'On time',
        late,
        location: 'Campus',
        locationLabel: locationLabel || 'Teacher Check-In',
        gps: gps?.latitude && gps?.longitude ? gps : null,
        geoFenceStatus: geoFence,
        faceMatch: true,
        faceConfidence: recognitionData.confidence || 0,
        proofImage: image,
        proofCapturedAt: now.toISOString(),
        createdAt: now.toISOString(),
      }
      db.teacherAttendance.push(record)
    } else {
      record.time = time
      record.status = 'present'
      record.remark = late ? 'Late Entry' : 'On time'
      record.late = late
      record.location = 'Campus'
      record.locationLabel = locationLabel || record.locationLabel
      record.gps = gps?.latitude && gps?.longitude ? gps : record.gps
      record.geoFenceStatus = geoFence
      record.faceMatch = true
      record.faceConfidence = recognitionData.confidence || record.faceConfidence
      record.proofImage = image
      record.proofCapturedAt = now.toISOString()
    }

    writeDb(db)
    return res.json({
      matched: true,
      teacher: sanitizeUser(teacher),
      record,
      geoFence,
      notification: late ? `Late teacher check-in marked for ${teacher.name}` : `Teacher attendance marked for ${teacher.name}`,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to mark teacher attendance.', detail: error.message })
  }
})

app.post('/api/attendance/scan', authMiddleware, async (req, res) => {
  try {
    const { image, locationLabel, gps, otpCode, otpChallengeId } = req.body
    const db = readDb()
    if (!image) return res.status(400).json({ message: 'Live webcam image is required.' })
    if (req.user.role === 'student') {
      const student = db.users.find((user) => user.id === req.user.id && user.role === 'student')
      const attendanceNow = new Date()
      const indiaNow = getIndiaDateTimeParts(attendanceNow)
      const windowStatus = evaluateStudentAttendanceWindow(attendanceNow, db)

      if (student && windowStatus.afterWindow) {
        let record = db.attendance.find((item) => item.studentId === student.id && item.date === indiaNow.date)
        if (!record) {
          record = createAbsentAttendanceRecord({
            db,
            student,
            now: attendanceNow,
            locationLabel: locationLabel || 'Student Live Check-in',
            gps,
            geoFence: null,
            reason: 'Attendance was not marked within the 09:00 AM to 05:00 PM window.',
            image,
          })
          record.method = 'daily-window-missed'
          await createParentNotification(db, {
            student,
            type: 'absent',
            title: 'Student marked absent',
            message: `${student.name} was marked absent because attendance was not marked between 09:00 AM and 05:00 PM on ${record.date}.`,
            attendanceRecord: record,
          })
        }
        writeDb(db)
        return res.status(403).json({
          matched: false,
          record,
          message: windowStatus.message,
        })
      }

      if (windowStatus.beforeWindow) {
        writeDb(db)
        return res.status(403).json({
          matched: false,
          message: windowStatus.message,
        })
      }

      const verified = verifyAttendanceOtpChallenge(db, {
        userId: req.user.id,
        challengeId: otpChallengeId,
        otpCode,
      })
      if (!verified.ok) {
        writeDb(db)
        return res.status(403).json({ message: 'Valid attendance OTP ya fresh login OTP required before face attendance can be marked.' })
      }
      writeDb(db)
    }
    const geoFence = evaluateGeoFence(gps, db)
    if (!geoFence.allowed) {
      if (req.user.role === 'student') {
        const db = readDb()
        const student = db.users.find((user) => user.id === req.user.id && user.role === 'student')
        if (student) {
          const record = createAbsentAttendanceRecord({
            db,
            student,
            now: new Date(),
            locationLabel,
            gps,
            geoFence,
            reason: geoFence.message,
            image,
          })
          await createParentNotification(db, {
            student,
            type: 'absent',
            title: 'Student marked absent',
            message: `${student.name} was marked absent because attendance was attempted outside the authorized area or without location access on ${record.date} at ${record.time}.`,
            attendanceRecord: record,
          })
          writeDb(db)
          return res.status(403).json({
            matched: false,
            geoFence,
            record,
            message: `${geoFence.message} Out of range for ${geoFence.zone.name}.`,
          })
        }
      }
      return res.status(403).json({
        matched: false,
        geoFence,
        message: `${geoFence.message} Out of range for ${geoFence.zone.name}.`,
      })
    }

    const currentStudent = req.user.role === 'student'
      ? db.users.find((user) => user.id === req.user.id && user.role === 'student')
      : null

    if (req.user.role === 'student' && (!currentStudent?.faceRegistered || !currentStudent?.faceSamples?.length)) {
      return res.status(403).json({
        matched: false,
        message: 'Face dataset not registered for this student. Please register your own face samples first.',
      })
    }

    if (currentStudent) {
      await syncFaceProfile(currentStudent, db)
    }

    const engagementResponse = await axios.post(`${env.faceApiUrl}/analyze-engagement`, { image })
    const [generalRecognition, strictRecognition] = await Promise.all([
      axios.post(`${env.faceApiUrl}/recognize-face`, { image }),
      req.user.role === 'student'
        ? axios.post(`${env.faceApiUrl}/recognize-face`, {
            image,
            expectedUserId: req.user.id,
            expectedEmail: req.user.email,
            strictExpected: true,
          })
        : Promise.resolve({ data: { matched: false } }),
    ])

    const strictMatchesCurrentStudent = req.user.role === 'student' && strictRecognition.data?.matched && strictRecognition.data?.userId === req.user.id

    if (req.user.role === 'student' && !strictMatchesCurrentStudent && generalRecognition.data?.matched && generalRecognition.data?.userId && generalRecognition.data.userId !== req.user.id) {
      await createParentNotification(db, {
        student: currentStudent || db.users.find((user) => user.id === req.user.id),
        type: 'proxy-warning',
        title: 'Proxy attendance warning',
        message: `A face mismatch was detected for ${req.user.name}. The scanned face belongs to another registered student account.`,
        attendanceRecord: null,
      })
      writeDb(db)
      return res.status(403).json({ matched: false, message: 'Fake attendance blocked. This face belongs to another registered student account.' })
    }

    const recognition = req.user.role === 'student'
      ? (strictRecognition.data?.matched ? strictRecognition : generalRecognition)
      : generalRecognition

    if (!recognition.data?.matched || !recognition.data?.userId) {
      return res.status(404).json({ matched: false, message: 'Face mismatch warning: scanned face does not match your registered student account.' })
    }

    let resolvedRecognitionData = recognition.data
    let student = findStudentFromRecognition(db, resolvedRecognitionData)

    if (!student && req.user.role !== 'student') {
      const teacherFallback = await resolveTeacherScannerStudent(db, image, resolvedRecognitionData)
      student = teacherFallback.student
      resolvedRecognitionData = teacherFallback.recognitionData || resolvedRecognitionData
    }

    if (student) {
      await syncFaceProfile(student, db)
    }

    if (!student) return res.status(404).json({ matched: false, message: 'Matched face is not linked to a student account.' })
    if (req.user.role === 'student' && student.id !== req.user.id) {
      await createParentNotification(db, {
        student: currentStudent || db.users.find((user) => user.id === req.user.id) || student,
        type: 'proxy-warning',
        title: 'Proxy attendance warning',
        message: `A face mismatch was detected for ${req.user.name}. The scanned face did not match the logged-in student account.`,
        attendanceRecord: null,
      })
      writeDb(db)
      return res.status(403).json({ matched: false, message: 'Face mismatch warning: scanned face does not match your student account.' })
    }

    const now = new Date()
    const indiaNow = getIndiaDateTimeParts(now)
    const date = indiaNow.date
    const time = indiaNow.time

    if (req.user.role !== 'student') {
      const windowStatus = evaluateStudentAttendanceWindow(now, db)
      if (windowStatus.beforeWindow) {
        return res.status(403).json({
          matched: false,
          message: windowStatus.message,
        })
      }

      if (windowStatus.afterWindow) {
        const record = createAbsentAttendanceRecord({
          db,
          student,
          now,
          locationLabel: locationLabel || 'Teacher Dashboard Scanner',
          gps,
          geoFence,
          reason: 'Attendance was not marked within the 09:00 AM to 05:00 PM window.',
          image,
        })
        record.method = 'daily-window-missed'
        await createParentNotification(db, {
          student,
          type: 'absent',
          title: 'Student marked absent',
          message: `${student.name} was marked absent because attendance was not marked between 09:00 AM and 05:00 PM on ${record.date}.`,
          attendanceRecord: record,
        })
        writeDb(db)
        return res.status(403).json({
          matched: false,
          record,
          message: windowStatus.message,
        })
      }
    }

    const suspiciousMeta = detectSuspiciousAttendance({ student, db, now, gps, locationLabel })
    const scanEvent = {
      createdAt: now.toISOString(),
      gps: gps?.latitude && gps?.longitude ? gps : null,
      locationLabel: locationLabel || 'Smart Attendance Desk',
      suspicious: suspiciousMeta.suspicious,
      suspiciousFlags: suspiciousMeta.flags,
    }
    let record = db.attendance.find((item) => item.studentId === student.id && item.date === date)

    if (!record) {
      record = {
        id: createId('att'),
        studentId: student.id,
        date,
        time,
        status: 'present',
        method: gps?.latitude ? 'face-gps' : 'face-recognition',
        confidence: resolvedRecognitionData.confidence || 0,
        emotionState: engagementResponse.data?.state || 'attentive',
        engagementScore: engagementResponse.data?.engagementScore || 0,
        proofImage: image,
        proofCapturedAt: now.toISOString(),
        locationLabel: locationLabel || 'Smart Attendance Desk',
        gps: gps?.latitude && gps?.longitude ? gps : null,
        geoFenceStatus: geoFence,
        suspicious: suspiciousMeta.suspicious,
        suspiciousFlags: suspiciousMeta.flags,
        suspiciousScore: suspiciousMeta.score,
        scanEvents: [scanEvent],
        createdAt: now.toISOString(),
        withinAttendanceWindow: true,
      }
      db.attendance.push(record)
    } else {
      if (record.status === 'absent' && (record.method === 'daily-auto-absent' || record.method === 'daily-window-missed')) {
        record.absentReason = null
      }
      record.withinAttendanceWindow = true
      record.time = time
      record.status = 'present'
      record.confidence = resolvedRecognitionData.confidence || record.confidence
      record.emotionState = engagementResponse.data?.state || record.emotionState
      record.engagementScore = engagementResponse.data?.engagementScore || record.engagementScore
      record.proofImage = image || record.proofImage || null
      record.proofCapturedAt = now.toISOString()
      record.locationLabel = locationLabel || record.locationLabel
      record.gps = gps?.latitude && gps?.longitude ? gps : record.gps
      record.geoFenceStatus = geoFence
      record.scanEvents = [...(record.scanEvents || []), scanEvent]
      record.suspicious = suspiciousMeta.suspicious || Boolean(record.suspicious)
      record.suspiciousFlags = [...(record.suspiciousFlags || []), ...suspiciousMeta.flags].filter(
        (flag, index, list) => index === list.findIndex((item) => item.code === flag.code),
      )
      record.suspiciousScore = Math.max(record.suspiciousScore || 0, suspiciousMeta.score)
    }

    const totalRecords = db.attendance.filter((item) => item.studentId === student.id).length
    student.attendancePercentage = Math.min(100, totalRecords * 5)

    await createParentNotification(db, {
      student,
      type: 'attendance-marked',
      title: 'Attendance marked',
      message: `${student.name}'s attendance was marked present on ${record.date} at ${record.time}.${locationLabel ? ` Location: ${locationLabel}.` : ''}`,
      attendanceRecord: record,
      skipDedup: true,
    })

    if (student.attendancePercentage < 75) {
      await createParentNotification(db, {
        student,
        type: 'low-attendance',
        title: 'Low attendance alert',
        message: `${student.name}'s attendance is currently ${student.attendancePercentage}%. Please review their attendance record.`,
        attendanceRecord: record,
      })
    }

    if (suspiciousMeta.flags.some((flag) => flag.code === 'location-mismatch')) {
      await createParentNotification(db, {
        student,
        type: 'location-mismatch',
        title: 'Location mismatch alert',
        message: `${student.name}'s attendance triggered a location mismatch warning. Please verify the student was physically present in class.`,
        attendanceRecord: record,
      })
    }

    writeDb(db)

    return res.json({
      matched: true,
      student: sanitizeUser(student),
      record,
      engagement: engagementResponse.data,
      geoFence,
      notification: suspiciousMeta.suspicious
        ? `Suspicious attendance detected for ${student.name} at ${time}`
        : `Attendance marked for ${student.name} at ${time}`,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to mark attendance.', detail: error.message })
  }
})

app.get('/api/attendance', authMiddleware, (req, res) => {
  const db = readDb()
  const targetIds = req.user.role === 'student' ? [req.user.id] : []
  if (reconcileDailyAttendanceForUsers(db, targetIds)) {
    writeDb(db)
  }
  const { date, studentId, month } = req.query
  let records = db.attendance
  if (date) records = records.filter((record) => record.date === date)
  if (studentId) records = records.filter((record) => record.studentId === studentId)
  if (month) records = records.filter((record) => record.date.startsWith(month))
  records = records
    .map((record) => ({
      ...record,
      student: sanitizeUser(db.users.find((user) => user.id === record.studentId) || {}),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return res.json({ records })
})

app.get('/api/attendance/teacher-summary', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  const db = readDb()
  if (reconcileDailyAttendanceForUsers(db)) {
    writeDb(db)
  }
  const students = db.users.filter((user) => user.role === 'student')
  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = db.attendance.filter((record) => record.date === today)
  const absentRecords = db.attendance.filter((record) => record.status === 'absent')
  const justificationSummary = summarizeJustificationSignals(absentRecords)

  const monthlyMap = new Map()
  const departmentMap = new Map()
  for (const record of db.attendance) {
    const month = record.date.slice(0, 7)
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1)
    const student = db.users.find((user) => user.id === record.studentId)
    const department = student?.department || 'General'
    departmentMap.set(department, (departmentMap.get(department) || 0) + 1)
  }

  const recentRecords = db.attendance
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((record) => ({ ...record, student: sanitizeUser(db.users.find((user) => user.id === record.studentId) || {}) }))

  const suspiciousRecords = db.attendance
    .filter((record) => record.suspicious)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((record) => ({ ...record, student: sanitizeUser(db.users.find((user) => user.id === record.studentId) || {}) }))

  const parentAlerts = db.notifications
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)

  const justificationRecords = absentRecords
    .filter((record) => record.justification || record.absentReason)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((record) => ({ ...record, student: sanitizeUser(db.users.find((user) => user.id === record.studentId) || {}) }))

  const interventionAnalytics = buildInterventionAnalytics(db)

  return res.json({
    stats: {
      totalStudents: students.length,
      todayAttendance: todayRecords.length,
      attendanceRate: students.length ? Number(((todayRecords.length / students.length) * 100).toFixed(1)) : 0,
      lowAttendanceCount: students.filter((student) => (student.attendancePercentage || 0) < 75).length,
      suspiciousCount: db.attendance.filter((record) => record.suspicious).length,
      parentAlertCount: db.notifications.length,
      justificationPendingCount: justificationSummary.pending,
      fakeReasonCount: justificationSummary.fake,
      interventionCount: interventionAnalytics.total,
      interventionSuccessRate: interventionAnalytics.successRate,
    },
    monthlyTrend: [...monthlyMap.entries()].map(([month, count]) => ({ month, count })),
    departmentStats: [...departmentMap.entries()].map(([name, value]) => ({ name, value })),
    recentRecords,
    suspiciousRecords,
    parentAlerts,
    justificationSummary,
    justificationRecords,
    interventionAnalytics,
  })
})

app.get('/api/admin/overview', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const db = readDb()
  const today = getIndiaDateTimeParts(new Date()).date
  const teacherSummary = buildTeacherAttendanceSummary(db, { date: today })
  const teachers = getTeachers(db).map(sanitizeUser)
  const students = db.users.filter((user) => user.role === 'student').map(sanitizeUser)

  return res.json({
    stats: {
      totalTeachers: teachers.length,
      totalStudents: students.length,
      presentToday: teacherSummary.stats.presentToday,
      absentToday: teacherSummary.stats.absentToday,
      latePercentage: teacherSummary.stats.latePercentage,
    },
    teachers,
    students,
    teacherAttendance: teacherSummary.presentRecords,
    lateTeachers: teacherSummary.lateRecords,
    absentTeachers: teacherSummary.absentTeachers,
    alerts: teacherSummary.alerts,
  })
})

app.get('/api/admin/teacher-attendance', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const db = readDb()
  const { date = getIndiaDateTimeParts(new Date()).date, teacherId = '' } = req.query
  return res.json(buildTeacherAttendanceSummary(db, { date, teacherId }))
})

app.get('/api/admin/config', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const db = readDb()
  return res.json({
    config: getSystemConfig(db),
  })
})

app.put('/api/admin/config', authMiddleware, roleMiddleware('admin'), (req, res) => {
  const db = readDb()
  const incoming = req.body || {}
  const nextConfig = {
    ...getSystemConfig(db),
    ...incoming,
    studentAttendanceWindow: {
      ...getSystemConfig(db).studentAttendanceWindow,
      ...(incoming.studentAttendanceWindow || {}),
    },
    teacherAttendanceWindow: {
      ...getSystemConfig(db).teacherAttendanceWindow,
      ...(incoming.teacherAttendanceWindow || {}),
    },
    geoFence: {
      ...getSystemConfig(db).geoFence,
      ...(incoming.geoFence || {}),
    },
  }

  db.systemConfig = {
    ...nextConfig,
    geoFence: {
      ...nextConfig.geoFence,
      latitude: Number(nextConfig.geoFence.latitude),
      longitude: Number(nextConfig.geoFence.longitude),
      radiusMeters: Number(nextConfig.geoFence.radiusMeters),
    },
  }
  writeDb(db)
  return res.json({
    message: 'System configuration updated successfully.',
    config: db.systemConfig,
  })
})

app.get('/api/academic-calendar', authMiddleware, (req, res) => {
  const db = readDb()
  return res.json({
    events: getAcademicCalendar(db),
  })
})

app.post('/api/academic-calendar', authMiddleware, roleMiddleware('teacher', 'admin'), (req, res) => {
  const { date, title, type = 'no-class', time = '', skipAttendance = true } = req.body
  if (!date || !title) {
    return res.status(400).json({ message: 'Date and title are required.' })
  }

  const allowedTypes = new Set(['event', 'exam', 'holiday', 'no-class'])
  if (!allowedTypes.has(type)) {
    return res.status(400).json({ message: 'Invalid calendar type.' })
  }

  const db = readDb()
  db.academicCalendar = db.academicCalendar || getAcademicCalendar(db)
  const existing = db.academicCalendar.find((item) => item.date === date && item.title === title)
  if (existing) {
    existing.type = type
    existing.time = time || existing.time || ''
    existing.skipAttendance = Boolean(skipAttendance || type === 'holiday' || type === 'no-class')
  } else {
    db.academicCalendar.push({
      id: createId('event'),
      date,
      title,
      type,
      time,
      skipAttendance: Boolean(skipAttendance || type === 'holiday' || type === 'no-class'),
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    })
  }

  writeDb(db)
  return res.json({
    success: true,
    message: 'Calendar day saved successfully. Attendance will be skipped for no-class and holiday dates.',
    events: getAcademicCalendar(db),
  })
})

app.post('/api/chat', authMiddleware, async (req, res) => {
  try {
    const { message, history = [], language = 'en' } = req.body
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Chat message is required.' })
    }

    const db = readDb()
    const context = getRoleContext(req, db)
    const response = await generateAssistantResponse({
      context,
      message: String(message).trim(),
      history: Array.isArray(history) ? history : [],
      language,
    })

    return res.json({
      answer: response.answer,
      mode: response.mode,
      contextPreview: {
        role: context.role,
        attendancePercentage: context.attendancePercentage || null,
        suspiciousCount: context.suspiciousCount || 0,
        upcomingEvents: context.upcomingEvents || [],
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'AI assistant is unavailable right now.', detail: error.message })
  }
})

app.get('/api/attendance/export/csv', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  const db = readDb()
  const lines = [
    ['Student Name', 'Email', 'Department', 'Student Code', 'Date', 'Time', 'Status', 'Method', 'Confidence'].join(','),
    ...db.attendance.map((record) => {
      const student = db.users.find((user) => user.id === record.studentId) || {}
      return [
        student.name || '',
        student.email || '',
        student.department || '',
        student.studentCode || '',
        record.date,
        record.time,
        record.status,
        record.method,
        record.confidence,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    }),
  ]
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv')
  return res.send(lines.join('\n'))
})

app.post('/api/face-recognition/register', authMiddleware, async (req, res) => {
  const { data } = await axios.post(`${env.faceApiUrl}/register-face`, req.body)
  return res.json(data)
})

app.post('/api/face-recognition/recognize', authMiddleware, async (req, res) => {
  const { data } = await axios.post(`${env.faceApiUrl}/recognize-face`, req.body)
  return res.json(data)
})

app.listen(env.port, () => {
  console.log(`Server listening on http://127.0.0.1:${env.port}`)
})
