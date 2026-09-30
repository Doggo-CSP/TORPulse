import type { Request, Response } from 'express'

import { CATEGORY_KEYS, CATEGORY_LABELS } from './category.constants.js'

// ---------------------------------------------------------------------------
// GET /api/v1/categories
// ---------------------------------------------------------------------------

export async function getCategoriesHandler(_req: Request, res: Response): Promise<void> {
  res.json(CATEGORY_KEYS.map((key) => ({ key, name: CATEGORY_LABELS[key] })))
}
