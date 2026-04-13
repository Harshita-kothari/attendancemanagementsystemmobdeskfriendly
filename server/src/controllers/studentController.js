import bcrypt from 'bcryptjs'
import { Attendance } from '../models/Attendance.js'
import { User } from '../models/User.js'
import { registerFace } from '../services/faceApiService.js'

function mapStudent(student) {
  return {
    id: student._id,
    name: student.name,
    email: student.email,
    department: student.department,
    studentCode: student.studentCode,
    avatar: student.avatar,
    faceRegistered: student.faceRegistered,
    attendancePercentage: student.attendancePercentage,
    createdAt: student.createdAt,
  }
}

async function recalculateAttendance(studentId) {
  const records = await Attendance.find({ student: studentId })
  const percentage = records.length ? Math.min(100, records.length * 5) : 0
  await User.findByIdAndUpdate(studentId, { attendancePercentage: percentage })
}

export async function listStudents(req, res) {
  const students = await User.find({ role: 'student' }).sort({ createdAt: -1 })
  return res.json({ students: students.map(mapStudent) })
}

export async function createStudent(req, res) {
  try {
    const { name, email, password, department, faceImages = [] } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) {
      return res.status(409).json({ message: 'Student email already exists.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const student = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'student',
      department: department || 'General',
      studentCode: `STU-${Date.now().toString().slice(-6)}`,
      avatar: name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join(''),
    })

    if (faceImages.length) {
      await registerFace({
        userId: String(student._id),
        name: student.name,
        email: student.email,
        images: faceImages,
      })
      student.faceRegistered = true
      student.faceSamples = faceImages.map((imageUrl) => ({ imageUrl }))
      await student.save()
    }

    return res.status(201).json({ student: mapStudent(student) })
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create student.', detail: error.message })
  }
}

export async function deleteStudent(req, res) {
  const student = await User.findOneAndDelete({ _id: req.params.id, role: 'student' })
  if (!student) {
    return res.status(404).json({ message: 'Student not found.' })
  }

  await Attendance.deleteMany({ student: student._id })
  return res.json({ message: 'Student removed successfully.' })
}

export async function getStudentProfile(req, res) {
  const student = await User.findById(req.user._id)
  const records = await Attendance.find({ student: student._id }).sort({ createdAt: -1 }).limit(30)
  await recalculateAttendance(student._id)
  return res.json({ student: mapStudent(student), records })
}
