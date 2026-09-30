import { Router } from 'express'
import { requireAdmin } from '../../middleware/admin.middleware.js'
import {
  getAdminStats,
  getAdminUserById,
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  getAdminActivities,
  getAdminTors,
  getAdminTorById,
  updateAdminTor,
  verifyAdminTor,
  archiveAdminTor,
  deleteAdminTor,
} from './admin.controller.js'

const router = Router()

router.use(requireAdmin)

router.get('/stats', getAdminStats)
router.get('/users', getAdminUsers)
router.get('/users/:userId', getAdminUserById)
router.patch('/users/:userId/role', updateUserRole)
router.patch('/users/:userId/status', updateUserStatus)
router.get('/activities', getAdminActivities)
router.get('/tors', getAdminTors)
router.get('/tors/:torId', getAdminTorById)
router.patch('/tors/:torId', updateAdminTor)
router.post('/tors/:torId/verify', verifyAdminTor)
router.post('/tors/:torId/archive', archiveAdminTor)
router.delete('/tors/:torId', deleteAdminTor)

export default router
