import { Router } from 'express'
import { requireAdmin, requireRole } from '../../middleware/admin.middleware.js'
import {
  getAdminStats,
  getAdminUserById,
  getAdminUsers,
  updateAdminUser,
  updateUserRole,
  updateUserStatus,
  getAdminActivity,
  getAdminTors,
  getAdminTorById,
  updateAdminTor,
  verifyAdminTor,
  archiveAdminTor,
  deleteAdminTor,
  getAdminSettings,
  updateAdminSettings,
  getIngestionStatus,
  triggerIngestionSync,
} from './admin.controller.js'

const router = Router()

// Admins and editors reach /admin; user, activity and settings routes are admin-only.
// TODO(QUESTION-9): should editors also see the activity feed? see QUESTIONS.md
router.use(requireRole('admin', 'editor'))

router.get('/stats', getAdminStats)
router.get('/ingestion/status', getIngestionStatus)
router.post('/ingestion/sync', triggerIngestionSync)
router.get('/users', requireAdmin, getAdminUsers)
router.get('/users/:userId', requireAdmin, getAdminUserById)
router.patch('/users/:userId', requireAdmin, updateAdminUser)
router.patch('/users/:userId/role', requireAdmin, updateUserRole)
router.patch('/users/:userId/status', requireAdmin, updateUserStatus)
router.get('/activity', requireAdmin, getAdminActivity)
router.get('/settings', requireAdmin, getAdminSettings)
router.patch('/settings', requireAdmin, updateAdminSettings)
router.get('/tors', getAdminTors)
router.get('/tors/:torId', getAdminTorById)
router.patch('/tors/:torId', updateAdminTor)
router.post('/tors/:torId/verify', verifyAdminTor)
router.post('/tors/:torId/archive', archiveAdminTor)
router.delete('/tors/:torId', deleteAdminTor)

export default router
