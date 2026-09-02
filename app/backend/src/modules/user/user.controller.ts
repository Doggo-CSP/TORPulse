import type { Request, Response } from 'express'
import { User } from '../auth/user.model.js'
import { TorModel } from '../tor/tor.model.js'

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

export const getProfileHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const completionPercentage = calculateProfileCompletion(user)

  res.json({
    user: {
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
      bookmarkedTorIds: (user.bookmarkedTorIds || []).map((id: any) => id.toString()),
      completionPercentage,
    },
  })
}

export const updateProfileHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const {
    accountType,
    displayName,
    firstName,
    lastName,
    jobTitle,
    contactEmail,
    phone,
    image,
    address,
    about,
  } = req.body

  const updateFields: Record<string, any> = {}
  if (accountType && ['personal', 'company', 'agency'].includes(accountType)) {
    updateFields.accountType = accountType
  }
  if (typeof displayName === 'string') updateFields.displayName = displayName.trim()
  if (typeof firstName === 'string') updateFields.firstName = firstName.trim()
  if (typeof lastName === 'string') updateFields.lastName = lastName.trim()
  if (typeof jobTitle === 'string') updateFields.jobTitle = jobTitle.trim()
  if (typeof contactEmail === 'string') updateFields.contactEmail = contactEmail.trim()
  if (typeof phone === 'string') updateFields.phone = phone.trim()
  if (typeof image === 'string') updateFields.image = image.trim()
  if (typeof address === 'string') updateFields.address = address.trim()
  if (typeof about === 'string') updateFields.about = about.trim()

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true, runValidators: true },
  )

  if (!updatedUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const completionPercentage = calculateProfileCompletion(updatedUser)

  res.json({
    user: {
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      accountType: updatedUser.accountType ?? 'personal',
      displayName: updatedUser.displayName || '',
      firstName: updatedUser.firstName || '',
      lastName: updatedUser.lastName || '',
      jobTitle: updatedUser.jobTitle || '',
      contactEmail: updatedUser.contactEmail || updatedUser.email,
      phone: updatedUser.phone || '',
      address: updatedUser.address || '',
      about: updatedUser.about || '',
      interests: updatedUser.interests || [],
      bookmarkedTorIds: (updatedUser.bookmarkedTorIds || []).map((id: any) => id.toString()),
      completionPercentage,
    },
  })
}

export const updateInterestsHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { interests } = req.body
  if (!Array.isArray(interests)) {
    res.status(400).json({ error: 'interests must be an array of strings' })
    return
  }

  const cleanInterests = interests.filter((item) => typeof item === 'string').map((i) => i.trim())

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { interests: cleanInterests } },
    { new: true },
  )

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
  if (!torId) {
    res.status(400).json({ error: 'torId parameter is required' })
    return
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const currentBookmarks = (user.bookmarkedTorIds || []).map((id: any) => id.toString())
  const isBookmarked = currentBookmarks.includes(torId)

  let updatedUser
  if (isBookmarked) {
    updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { bookmarkedTorIds: torId } },
      { new: true },
    )
  } else {
    updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { bookmarkedTorIds: torId } },
      { new: true },
    )
  }

  res.json({
    bookmarked: !isBookmarked,
    bookmarkedTorIds: (updatedUser?.bookmarkedTorIds || []).map((id: any) => id.toString()),
  })
}

export const getBookmarksHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const user = await User.findById(req.user._id).populate('bookmarkedTorIds')
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({
    tors: user.bookmarkedTorIds || [],
  })
}

export const getRecommendedTorsHandler = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const interests = user.interests || []
  let filter = {}

  if (interests.length > 0) {
    const keywordMap: Record<string, string[]> = {
      web: ['เว็บ', 'web', 'พอร์ทัล', 'portal'],
      data: ['ข้อมูล', 'data', 'วิเคราะห์', 'bi', 'แดชบอร์ด', 'dashboard'],
      mobile: ['มือถือ', 'mobile', 'แอปพลิเคชัน', 'ios', 'android', 'app'],
      enterprise: ['องค์กร', 'enterprise', 'สารสนเทศ', 'หลังบ้าน', 'erp'],
      consulting: ['ที่ปรึกษา', 'consulting', 'สถาปัตยกรรม', 'architecture', 'ออกแบบ'],
      cybersecurity: ['ไซเบอร์', 'cybersecurity', 'ความมั่นคง', 'ปลอดภัย', 'security'],
      ai: ['ปัญญาประดิษฐ์', 'ai', 'machine learning', 'ml', 'อัตโนมัติ'],
      cloud: ['คลาวด์', 'cloud', 'โครงสร้างพื้นฐาน', 'infrastructure', 'เครือข่าย', 'network'],
    }

    const matchedKeywords: string[] = []
    interests.forEach((cat) => {
      if (keywordMap[cat]) {
        matchedKeywords.push(...keywordMap[cat])
      } else {
        matchedKeywords.push(cat)
      }
    })

    if (matchedKeywords.length > 0) {
      filter = {
        $or: [
          { projectTitle: { $regex: matchedKeywords.join('|'), $options: 'i' } },
          { summary: { $regex: matchedKeywords.join('|'), $options: 'i' } },
          { classificationReason: { $regex: matchedKeywords.join('|'), $options: 'i' } },
          { technologies: { $in: matchedKeywords } },
        ],
      }
    }
  }

  const tors = await TorModel.find(filter).sort({ createdAt: -1 }).limit(20)

  res.json({
    tors,
    matchedInterests: interests,
  })
}
