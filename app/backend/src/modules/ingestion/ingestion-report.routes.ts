import { Router } from 'express'

import { requireAdmin, requireScope } from '../../middleware/admin.middleware.js'

import {
  buildPipelineReport,
  fetchStatusStageCounts,
  renderPipelineHtml,
} from './ingestion-report.js'

const router = Router()

// Pipeline internals (job counts, failures) are for operators only (threat T12)
router.use(requireAdmin, requireScope('ingestion:read'))

// GET /api/v1/ingestion/report        -> HTML pipeline diagram
// GET /api/v1/ingestion/report?format=json -> the same numbers as JSON
router.get('/report', async (req, res, next) => {
  try {
    const report = buildPipelineReport(await fetchStatusStageCounts())

    if (req.query.format === 'json') {
      res.json({ success: true, data: report })
      return
    }

    res.type('html').send(renderPipelineHtml(report))
  } catch (error) {
    next(error)
  }
})

export default router
