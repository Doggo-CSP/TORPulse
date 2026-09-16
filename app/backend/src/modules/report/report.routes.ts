import { Router } from 'express'

import {
  categoryComparisonHandler,
  departmentsFilterHandler,
  priceOverviewHandler,
  procurementListHandler,
  savingsDistributionHandler,
} from './report.controller.js'

const router = Router()

router.get('/price-overview', priceOverviewHandler)
router.get('/savings-distribution', savingsDistributionHandler)
router.get('/category-comparison', categoryComparisonHandler)
router.get('/procurement-list', procurementListHandler)
router.get('/filters/departments', departmentsFilterHandler)

export default router
