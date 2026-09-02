import { Router } from 'express'
import {
  getBookmarksHandler,
  getProfileHandler,
  getRecommendedTorsHandler,
  toggleBookmarkHandler,
  updateInterestsHandler,
  updateProfileHandler,
} from './user.controller.js'

const router = Router()

router.get('/profile', getProfileHandler)
router.put('/profile', updateProfileHandler)
router.put('/interests', updateInterestsHandler)
router.post('/bookmarks/:torId', toggleBookmarkHandler)
router.get('/bookmarks', getBookmarksHandler)
router.get('/recommended', getRecommendedTorsHandler)

export default router
