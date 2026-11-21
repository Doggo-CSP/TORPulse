import { Router } from 'express'
import { requireAdmin, requireScope } from '../../middleware/admin.middleware.js'
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
  updateDataSource,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  setAdminCategoryStatus,
  deleteAdminCategory,
} from './admin.controller.js'

const router = Router()

// Every /admin route is admin-only, and each route also checks the scope it needs
router.use(requireAdmin)

router.get('/stats', requireScope('stats:read'), getAdminStats)
router.get('/ingestion/status', requireScope('ingestion:read'), getIngestionStatus)
router.post('/ingestion/sync', requireScope('ingestion:write'), triggerIngestionSync)
router.patch('/ingestion/sources/:key', requireScope('ingestion:write'), updateDataSource)
router.get('/users', requireScope('users:read'), getAdminUsers)
router.get('/users/:userId', requireScope('users:read'), getAdminUserById)
router.patch('/users/:userId', requireScope('users:write'), updateAdminUser)
router.patch('/users/:userId/role', requireScope('users:manage'), updateUserRole)
router.patch('/users/:userId/status', requireScope('users:manage'), updateUserStatus)
router.get('/activity', requireScope('activity:read'), getAdminActivity)
router.get('/settings', requireScope('settings:read'), getAdminSettings)
router.patch('/settings', requireScope('settings:write'), updateAdminSettings)
router.get('/tors', requireScope('tors:read'), getAdminTors)
router.get('/tors/:torId', requireScope('tors:read'), getAdminTorById)
router.patch('/tors/:torId', requireScope('tors:write'), updateAdminTor)
router.post('/tors/:torId/verify', requireScope('tors:write'), verifyAdminTor)
router.post('/tors/:torId/archive', requireScope('tors:write'), archiveAdminTor)
router.delete('/tors/:torId', requireScope('tors:delete'), deleteAdminTor)
router.get('/categories', requireScope('categories:read'), getAdminCategories)
router.post('/categories', requireScope('categories:write'), createAdminCategory)
router.patch('/categories/:categoryId', requireScope('categories:write'), updateAdminCategory)
router.patch(
  '/categories/:categoryId/status',
  requireScope('categories:write'),
  setAdminCategoryStatus,
)
router.delete('/categories/:categoryId', requireScope('categories:write'), deleteAdminCategory)

export default router
