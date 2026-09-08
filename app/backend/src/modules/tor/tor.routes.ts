import { Router } from 'express'

import { getFilterOptionsHandler, getRecommendationsHandler, listTorsHandler } from './tor.controller.js'

const router = Router()

router.get('/filter-options', getFilterOptionsHandler)
router.get('/recommendations', getRecommendationsHandler)
router.get('/', listTorsHandler)

export default router
