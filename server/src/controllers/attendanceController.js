import { Attendance } from '../models/Attendance.js'
import { User } from '../models/User.js'
import { recognizeFace } from '../services/faceApiService.js'

function getDateParts() {
  const now = new Date()
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString('en-IN', { hour12: false }),
  }
}

async function refreshPercentage(studentId) {
  const total = await Attendance.countDocuments({ student: studentId })
  const percentage = total ? Math.min(100, total * 5) : 0
  await User.findByIdAndUpdate(studentId, { attendancePercentage: percentage })
}

export async function markAttendanceByFace(req, res) {
  try {
    const { image, locationLabel, gps } = req.body
    if (!image) {
      return res.status(400).json({ message: 'Live webcam image is required.' })
    }

    const recognition = await recognizeFace({ image })
    if (!recognition.matched || !recognition.userId) {
      return res.status(404).json({
        matched: false,
        message: recognition.message || 'Face mismatch warning: user not recognized.',
      })
    }

    const student = await User.findOne({ _id: recognition.userId, role: 'student' })
    if (!student) {
      return res.status(404).json({ matched: false, message: 'Matched face is not linked to a student account.' })
    }

    const { date, time } = getDateParts()
    const record = await Attendance.findOneAndUpdate(
      { student: student._id, date },
      {
        student: student._id,
        recordedBy: req.user?._id || null,
        date,
        time,
        status: 'present',
        method: gps?.latitude ? 'face-gps' : 'face-recognition',
        confidence: recognition.confidence || 0,
        device: 'webcam',
        locationLabel: locationLabel || 'Smart Attendance Desk',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    await refreshPercentage(student._id)
    return res.json({
      matched: true,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        department: student.department,
        studentCode: student.studentCode,
      },
      record,
      notification: `Attendance marked for ${student.name} at ${time}`,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to mark attendance.', detail: error.message })
  }
}

export async function listAttendance(req, res) {
  const { date, studentId } = req.query
  const query = {}
  if (date) query.date = date
  if (studentId) query.student = studentId

  const records = await Attendance.find(query)
    .populate('student', 'name email department studentCode avatar')
    .sort({ createdAt: -1 })

  return res.json({ records })
}

export async function getTeacherSummary(req, res) {
  const students = await User.find({ role: 'student' })
  const records = await Attendance.find().populate('student', 'department')
  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = records.filter((record) => record.date === today)

  const monthlyMap = new Map()
  const departmentMap = new Map()
  for (const record of records) {
    const monthKey = record.date.slice(0, 7)
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1)
    const dept = record.student?.department || 'General'
    departmentMap.set(dept, (departmentMap.get(dept) || 0) + 1)
  }

  return res.json({
    stats: {
      totalStudents: students.length,
      todayAttendance: todayRecords.length,
      attendanceRate: students.length ? Number(((todayRecords.length / students.length) * 100).toFixed(1)) : 0,
      lowAttendanceCount: students.filter((student) => student.attendancePercentage < 75).length,
    },
    monthlyTrend: [...monthlyMap.entries()].map(([month, count]) => ({ month, count })),
    departmentStats: [...departmentMap.entries()].map(([name, value]) => ({ name, value })),
    recentRecords: records.slice(0, 8),
  })
}

export async function exportAttendanceCsv(req, res) {
  const records = await Attendance.find().populate('student', 'name email department studentCode').sort({ createdAt: -1 })
  const lines = [
    ['Student Name', 'Email', 'Department', 'Student Code', 'Date', 'Time', 'Status', 'Method', 'Confidence'].join(','),
    ...records.map((record) =>
      [
        record.student?.name || '',
        record.student?.email || '',
        record.student?.department || '',
        record.student?.studentCode || '',
        record.date,
        record.time,
        record.status,
        record.method,
        record.confidence,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    ),
  ]

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv')
  return res.send(lines.join('\n'))
}
