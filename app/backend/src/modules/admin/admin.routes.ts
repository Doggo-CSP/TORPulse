import { Router } from 'express'
import { requireAdmin } from '../../middleware/admin.middleware.js'
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
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  setAdminCategoryStatus,
  deleteAdminCategory,
} from './admin.controller.js'

const router = Router()

// Every /admin route is admin-only
router.use(requireAdmin)

router.get('/stats', getAdminStats)
router.get('/ingestion/status', getIngestionStatus)
router.post('/ingestion/sync', triggerIngestionSync)
router.get('/users', getAdminUsers)
router.get('/users/:userId', getAdminUserById)
router.patch('/users/:userId', updateAdminUser)
router.patch('/users/:userId/role', updateUserRole)
router.patch('/users/:userId/status', updateUserStatus)
router.get('/activity', getAdminActivity)
router.get('/settings', getAdminSettings)
router.patch('/settings', updateAdminSettings)
router.get('/tors', getAdminTors)
router.get('/tors/:torId', getAdminTorById)
router.patch('/tors/:torId', updateAdminTor)
router.post('/tors/:torId/verify', verifyAdminTor)
router.post('/tors/:torId/archive', archiveAdminTor)
router.delete('/tors/:torId', deleteAdminTor)
router.get('/categories', getAdminCategories)
router.post('/categories', createAdminCategory)
router.patch('/categories/:categoryId', updateAdminCategory)
router.patch('/categories/:categoryId/status', setAdminCategoryStatus)
router.delete('/categories/:categoryId', deleteAdminCategory)

export default router
