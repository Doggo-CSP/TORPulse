import { Router } from 'express'

import { getAnalyticsHandler, getSummaryHandler } from './homepage.controller.js'

const router = Router()

router.get('/summary', getSummaryHandler)
router.get('/analytics', getAnalyticsHandler)

export default router
