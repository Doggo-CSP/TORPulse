import { Router } from 'express'

import {
  getFilterOptionsHandler,
  getRecommendationsHandler,
  getTorByIdHandler,
  listTorsHandler,
} from './tor.controller.js'

const router = Router()

router.get('/filter-options', getFilterOptionsHandler)
router.get('/recommendations', getRecommendationsHandler)
router.get('/', listTorsHandler)
router.get('/:id', getTorByIdHandler)

export default router
