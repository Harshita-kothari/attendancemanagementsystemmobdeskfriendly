import { Router } from 'express'
import { registerFace, recognizeFace } from '../services/faceApiService.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register', requireAuth, async (req, res) => {
  try {
    const data = await registerFace(req.body)
    return res.json(data)
  } catch (error) {
    return res.status(502).json({ message: 'Face API registration failed.', detail: error.message })
  }
})

router.post('/recognize', requireAuth, async (req, res) => {
  try {
    const data = await recognizeFace(req.body)
    return res.json(data)
  } catch (error) {
    return res.status(502).json({ message: 'Face API recognition failed.', detail: error.message })
  }
})

export default router
