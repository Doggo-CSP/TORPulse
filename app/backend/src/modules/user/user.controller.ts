import type { Request, Response } from 'express'

import { getActiveCategoryKeys } from '../category/category.repository.js'
import {
  addBookmark,
  countBookmarksByUser,
  findUserById,
  isBookmarked,
  listBookmarksByUser,
  removeBookmark,
  updateUserInterests,
  updateUserProfile,
} from './user.repository.js'
import { updateInterestsSchema, updateProfileSchema } from './user.validation.js'

const has = (v?: string | null) => Boolean(v?.trim())

export const calculateProfileCompletion = (user: any): number => {
  const personal = [
    has(user.displayName),
    has(user.firstName),
    has(user.lastName),
    has(user.jobTitle),
    has(user.contactEmail),
    has(user.phone),
    has(user.image),
    has(user.address),
    has(user.about),
    Boolean(user.interests && user.interests.length > 0),
  ]

  const company =
    user.accountType === 'company'
      ? [
          has(user.companyName),
          has(user.registrationNumber),
          has(user.registeredDate),
          has(user.businessType),
          has(user.businessObjectives),
          user.registeredCapital != null,
          user.yearsExperience != null,
          user.teamSize != null,
          user.budgetMin != null || user.budgetMax != null,
          (user.certifications?.length ?? 0) > 0,
          (user.pastProjects?.length ?? 0) > 0,
        ]
      : []

  const all = [...personal, ...company]
  return Math.round((all.filter(Boolean).length / all.length) * 100)
}

const toProfileResponse = (user: any, bookmarkedCount: number) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  image: user.image,
  accountType: user.accountType ?? 'personal',
  displayName: user.displayName || '',
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  jobTitle: user.jobTitle || '',
  contactEmail: user.contactEmail || user.email,
  phone: user.phone || '',
  address: user.address || '',
  about: user.about || '',
  interests: user.interests || [],
  website: user.website || '',
  companyName: user.companyName || '',
  registrationNumber: user.registrationNumber || '',
  businessType: user.businessType || '',
  registeredDate: user.registeredDate || '',
  registeredCapital: user.registeredCapital ?? null,
  yearsExperience: user.yearsExperience ?? null,
  teamSize: user.teamSize ?? null,
  budgetMin: user.budgetMin ?? null,
  budgetMax: user.budgetMax ?? null,
  businessObjectives: user.businessObjectives || '',
  certifications: user.certifications || [],
  isEgpRegistered: Boolean(user.isEgpRegistered),
  pastProjects: user.pastProjects || [],
  agencyName: user.agencyName || '',
  agencyType: user.agencyType || '',
  bookmarkedCount,
  completionPercentage: calculateProfileCompletion(user),
})

export const getProfileHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const user = await findUserById(req.user._id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const bookmarkedCount = await countBookmarksByUser(req.user._id)

  res.json({ user: toProfileResponse(user, bookmarkedCount) })
}

export const updateProfileHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const parsed = updateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const updatedUser = await updateUserProfile(req.user._id, parsed.data)
  if (!updatedUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const bookmarkedCount = await countBookmarksByUser(req.user._id)

  res.json({ user: toProfileResponse(updatedUser, bookmarkedCount) })
}

export const updateInterestsHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const parsed = updateInterestsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  // New picks must be active categories; hidden ones the user already has may stay.
  const [activeKeys, currentUser] = await Promise.all([
    getActiveCategoryKeys(),
    findUserById(req.user._id),
  ])
  const currentInterests = new Set<string>(currentUser?.interests ?? [])
  const invalid = parsed.data.interests.filter(
    (key) => !activeKeys.has(key) && !currentInterests.has(key),
  )
  if (invalid.length > 0) {
    res.status(400).json({ error: `Invalid or hidden categories: ${invalid.join(', ')}` })
    return
  }

  const updatedUser = await updateUserInterests(req.user._id, parsed.data.interests)
  if (!updatedUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({
    interests: updatedUser.interests || [],
    completionPercentage: calculateProfileCompletion(updatedUser),
  })
}

export const toggleBookmarkHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { torId } = req.params
  if (!torId || typeof torId !== 'string') {
    res.status(400).json({ error: 'torId parameter is required' })
    return
  }

  const alreadyBookmarked = await isBookmarked(req.user._id, torId)

  if (alreadyBookmarked) {
    await removeBookmark(req.user._id, torId)
  } else {
    await addBookmark(req.user._id, torId)
  }

  const bookmarkedCount = await countBookmarksByUser(req.user._id)

  res.json({
    bookmarked: !alreadyBookmarked,
    bookmarkedCount,
  })
}

export const getBookmarksHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const bookmarks = await listBookmarksByUser(req.user._id)

  res.json({
    tors: bookmarks.map((bookmark) => bookmark.torId).filter(Boolean),
  })
}
