import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { signToken } from '../utils/tokens.js'
import { registerFace } from '../services/faceApiService.js'

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    studentCode: user.studentCode,
    avatar: user.avatar,
    preferredLanguage: user.preferredLanguage,
    themePreference: user.themePreference,
    faceRegistered: user.faceRegistered,
    faceSamples: user.faceSamples,
    attendancePercentage: user.attendancePercentage,
  }
}

export async function signup(req, res) {
  try {
    const {
      name,
      email,
      password,
      role,
      department,
      preferredLanguage,
      themePreference,
      faceImages = [],
    } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' })
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const initials = name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      department: department || 'General',
      preferredLanguage: preferredLanguage || 'en',
      themePreference: themePreference || 'light',
      studentCode: role === 'student' ? `STU-${Date.now().toString().slice(-6)}` : '',
      avatar: initials,
    })

    if (role === 'student' && faceImages.length) {
      try {
        await registerFace({
          userId: String(user._id),
          name: user.name,
          email: user.email,
          images: faceImages,
        })
        user.faceRegistered = true
        user.faceSamples = faceImages.map((imageUrl) => ({ imageUrl }))
        await user.save()
      } catch (error) {
        return res.status(502).json({ message: 'Account created but face registration failed.', detail: error.message })
      }
    }

    const token = signToken({ userId: user._id, role: user.role })
    return res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (error) {
    return res.status(500).json({ message: 'Signup failed.', detail: error.message })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: email?.toLowerCase() })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const token = signToken({ userId: user._id, role: user.role })
    return res.json({ token, user: sanitizeUser(user) })
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', detail: error.message })
  }
}

export async function currentUser(req, res) {
  return res.json({ user: sanitizeUser(req.user) })
}
