import { Router } from 'express'

import { getCategoriesHandler } from './category.controller.js'

const router = Router()

router.get('/', getCategoriesHandler)

export default router
