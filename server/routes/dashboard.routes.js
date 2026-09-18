import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { getDashboardStats } from '../controllers/dashboard.controller.js'

const router = Router()

router.get('/', protect, authorize('recruiter', 'admin'), getDashboardStats)

export default router
