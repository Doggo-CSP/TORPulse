import { Router } from 'express'
import { requireAuth, requireScope } from '../../middleware/admin.middleware.js'
import {
  addProjectHandler,
  addTeamMemberHandler,
  getBidderProfileHandler,
  getBidderProfileOptionsHandler,
  removeProjectHandler,
  removeTeamMemberHandler,
  updateOrganizationHandler,
  updatePreferencesHandler,
  updateProjectHandler,
  updateSelfHandler,
  updateTeamMemberHandler,
} from './bidder-profile.controller.js'
import { listQualificationMatchesHandler } from '../qualification/qualification-match.controller.js'
import {
  getBookmarksHandler,
  getProfileHandler,
  toggleBookmarkHandler,
  updateInterestsHandler,
  updateOnboardingHandler,
  updateProfileHandler,
} from './user.controller.js'

const router = Router()

// Every /user route needs an active login; each route also checks the scope it needs
router.use(requireAuth)

const profileRead = requireScope('profile:read')
const profileWrite = requireScope('profile:write')

router.get('/profile', profileRead, getProfileHandler)
router.put('/profile', profileWrite, updateProfileHandler)
router.put('/interests', profileWrite, updateInterestsHandler)
router.put('/onboarding', profileWrite, updateOnboardingHandler)
router.post('/bookmarks/:torId', requireScope('bookmarks:write'), toggleBookmarkHandler)
router.get('/bookmarks', requireScope('bookmarks:read'), getBookmarksHandler)

// Bidder profile used by qualification matching (UC-07)
router.get('/bidder-profile', profileRead, getBidderProfileHandler)
router.get('/bidder-profile/options', profileRead, getBidderProfileOptionsHandler)
router.put('/bidder-profile/organization', profileWrite, updateOrganizationHandler)
router.put('/bidder-profile/self', profileWrite, updateSelfHandler)
router.put('/bidder-profile/preferences', profileWrite, updatePreferencesHandler)
router.post('/bidder-profile/team', profileWrite, addTeamMemberHandler)
router.patch('/bidder-profile/team/:memberId', profileWrite, updateTeamMemberHandler)
router.delete('/bidder-profile/team/:memberId', profileWrite, removeTeamMemberHandler)
router.post('/bidder-profile/projects', profileWrite, addProjectHandler)
router.patch('/bidder-profile/projects/:projectId', profileWrite, updateProjectHandler)
router.delete('/bidder-profile/projects/:projectId', profileWrite, removeProjectHandler)

// Precomputed qualification scores for a page of TOR cards
router.get(
  '/qualification-matches',
  requireScope('qualification:read'),
  listQualificationMatchesHandler,
)

export default router
