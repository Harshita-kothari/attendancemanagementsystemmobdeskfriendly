import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/face-attendance',
  jwtSecret: process.env.JWT_SECRET || 'change_me_super_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',
  faceApiUrl: process.env.FACE_API_URL || 'http://127.0.0.1:5001',
}
