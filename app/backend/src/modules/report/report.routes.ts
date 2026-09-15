import { Router } from 'express'

import {
  categoryPriceHistoryHandler,
  priceOverviewHandler,
  procurementComparisonHandler,
} from './report.controller.js'

const router = Router()

router.get('/procurement-comparison', procurementComparisonHandler)
router.get('/price-overview', priceOverviewHandler)
router.get('/category-price-history', categoryPriceHistoryHandler)

export default router
