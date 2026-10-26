import { Router } from 'express'
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
  updateProfileHandler,
} from './user.controller.js'

const router = Router()

router.get('/profile', getProfileHandler)
router.put('/profile', updateProfileHandler)
router.put('/interests', updateInterestsHandler)
router.post('/bookmarks/:torId', toggleBookmarkHandler)
router.get('/bookmarks', getBookmarksHandler)

// Bidder profile used by qualification matching (UC-07)
router.get('/bidder-profile', getBidderProfileHandler)
router.get('/bidder-profile/options', getBidderProfileOptionsHandler)
router.put('/bidder-profile/organization', updateOrganizationHandler)
router.put('/bidder-profile/self', updateSelfHandler)
router.put('/bidder-profile/preferences', updatePreferencesHandler)
router.post('/bidder-profile/team', addTeamMemberHandler)
router.patch('/bidder-profile/team/:memberId', updateTeamMemberHandler)
router.delete('/bidder-profile/team/:memberId', removeTeamMemberHandler)
router.post('/bidder-profile/projects', addProjectHandler)
router.patch('/bidder-profile/projects/:projectId', updateProjectHandler)
router.delete('/bidder-profile/projects/:projectId', removeProjectHandler)

// Precomputed qualification scores for a page of TOR cards
router.get('/qualification-matches', listQualificationMatchesHandler)

export default router
