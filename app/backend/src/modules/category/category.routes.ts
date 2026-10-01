import { Router } from 'express'

import { getCategoryCatalog } from './category.repository.js'

const router = Router()

// GET /api/v1/categories -> active TOR categories in display order
router.get('/', async (_req, res, next) => {
  try {
    const categories = await getCategoryCatalog()
    res.json({
      success: true,
      data: categories.map(({ key, name, description, order }) => ({
        key,
        name,
        description,
        order,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router
