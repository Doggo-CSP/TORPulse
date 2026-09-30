import { Router } from 'express'
import { requireAdmin } from '../../middleware/admin.middleware.js'
import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  getAdminActivities,
} from './admin.controller.js'

const router = Router()

router.use(requireAdmin)

router.get('/stats', getAdminStats)
router.get('/users', getAdminUsers)
router.patch('/users/:userId/role', updateUserRole)
router.patch('/users/:userId/status', updateUserStatus)
router.get('/activities', getAdminActivities)

export default router
