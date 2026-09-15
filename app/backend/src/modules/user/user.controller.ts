import type { Request, Response } from 'express'

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

export const calculateProfileCompletion = (user: any): number => {
  const fields = [
    Boolean(user.displayName && user.displayName.trim()),
    Boolean(user.firstName && user.firstName.trim()),
    Boolean(user.lastName && user.lastName.trim()),
    Boolean(user.jobTitle && user.jobTitle.trim()),
    Boolean(user.contactEmail && user.contactEmail.trim()),
    Boolean(user.phone && user.phone.trim()),
    Boolean(user.image && user.image.trim()),
    Boolean(user.address && user.address.trim()),
    Boolean(user.about && user.about.trim()),
    Boolean(user.interests && user.interests.length > 0),
  ]

  const completed = fields.filter(Boolean).length
  return Math.round((completed / fields.length) * 100)
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
