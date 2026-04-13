import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' })
    }

    const payload = jwt.verify(token, env.jwtSecret)
    const user = await User.findById(payload.userId).select('-password')
    if (!user) {
      return res.status(401).json({ message: 'User not found.' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to perform this action.' })
    }
    next()
  }
}
