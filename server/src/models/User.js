import mongoose from 'mongoose'

const faceSampleSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: '' },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher'], required: true },
    department: { type: String, default: 'General' },
    studentCode: { type: String, default: '' },
    avatar: { type: String, default: '' },
    preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
    themePreference: { type: String, enum: ['light', 'dark'], default: 'light' },
    faceRegistered: { type: Boolean, default: false },
    faceSamples: { type: [faceSampleSchema], default: [] },
    attendancePercentage: { type: Number, default: 0 },
    notificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const User = mongoose.model('User', userSchema)
