import { Router } from 'express'
import {
  exportAttendanceCsv,
  getTeacherSummary,
  listAttendance,
  markAttendanceByFace,
} from '../controllers/attendanceController.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.post('/scan', requireAuth, markAttendanceByFace)
router.get('/', requireAuth, listAttendance)
router.get('/teacher-summary', requireAuth, requireRole('teacher'), getTeacherSummary)
router.get('/export/csv', requireAuth, requireRole('teacher'), exportAttendanceCsv)

export default router
