import { Router } from 'express'

import {
  getFilterOptionsHandler,
  getRecommendationsHandler,
  getTorByIdHandler,
  listTorsHandler,
} from './tor.controller.js'
import { similarFinishedTorsHandler } from '../report/report.controller.js'

const router = Router()

router.get('/filter-options', getFilterOptionsHandler)
router.get('/recommendations', getRecommendationsHandler)
router.get('/', listTorsHandler)
router.get('/:id', getTorByIdHandler)
// Similar TORs whose bidding has closed, with mid and awarded prices (UC-05)
router.get('/:id/similar', similarFinishedTorsHandler)

export default router
