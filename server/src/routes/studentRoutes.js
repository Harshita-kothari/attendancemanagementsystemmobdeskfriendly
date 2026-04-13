import { Router } from 'express'
import { createStudent, deleteStudent, getStudentProfile, listStudents } from '../controllers/studentController.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, requireRole('teacher'), listStudents)
router.post('/', requireAuth, requireRole('teacher'), createStudent)
router.delete('/:id', requireAuth, requireRole('teacher'), deleteStudent)
router.get('/me/profile', requireAuth, requireRole('student'), getStudentProfile)

export default router
