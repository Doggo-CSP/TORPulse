import type { Request, Response } from 'express'

import { listCategories } from './category.repository.js'

// ---------------------------------------------------------------------------
// GET /api/v1/categories
// ---------------------------------------------------------------------------

// Only active categories, in display order; hidden ones are not offered to users.
export async function getCategoriesHandler(_req: Request, res: Response): Promise<void> {
  const categories = await listCategories({ activeOnly: true })
  res.json(
    categories.map((category) => ({
      key: category.key,
      name: category.name,
      description: category.description ?? '',
    })),
  )
}
