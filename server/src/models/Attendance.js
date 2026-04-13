import mongoose from 'mongoose'

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
    method: { type: String, default: 'face-recognition' },
    confidence: { type: Number, default: 0 },
    device: { type: String, default: 'webcam' },
    locationLabel: { type: String, default: 'Campus Gate' },
  },
  { timestamps: true },
)

attendanceSchema.index({ student: 1, date: 1 }, { unique: true })

export const Attendance = mongoose.model('Attendance', attendanceSchema)
