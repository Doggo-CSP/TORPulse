import type { Request, Response } from 'express'
import mongoose, { isObjectIdOrHexString, type ClientSession, type Types } from 'mongoose'
import { User, type UserDocument } from '../auth/user.model.js'
import { CATEGORY_LABELS, deriveCategory } from '../tor/tor.controller.js'
import { TorModel, type Tor, type TorReviewStatus } from '../tor/tor.model.js'
import { UserBookmarkModel } from '../user/user-bookmark.model.js'
import type { TorChangeOutcome, UserChangeOutcome } from './admin.types.js'
import { adminTorListQuerySchema, updateAdminTorSchema } from './admin.validation.js'
import { createAuditLog, listRecentAuditLogs } from './audit-log.repository.js'

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isActiveAdmin = (user: { role?: string; status?: string }): boolean =>
  user.role === 'admin' && (!user.status || user.status === 'active')

const hasOtherActiveAdmin = async (
  userId: Types.ObjectId,
  session: ClientSession,
): Promise<boolean> => {
  const count = await User.countDocuments(
    {
      _id: { $ne: userId },
      role: 'admin',
      $or: [{ status: 'active' }, { status: { $exists: false } }],
    },
    { session },
  )
  return count > 0
}

// Writing the actor inside the transaction makes two admins who change each other at the
// same time hit a write conflict, so one transaction retries and sees the other's change.
const touchActor = async (actorId: Types.ObjectId, session: ClientSession): Promise<void> => {
  await User.updateOne({ _id: actorId }, { $set: { updatedAt: new Date() } }, { session })
}

export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      adminCount,
      editorCount,
      userCount,
      totalTors,
      awardedCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ $or: [{ status: 'active' }, { status: { $exists: false } }] }),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'editor' }),
      User.countDocuments({ $or: [{ role: 'user' }, { role: { $exists: false } }] }),
      TorModel.countDocuments(),
      TorModel.countDocuments({ awardedPriceBaht: { $ne: null } }),
    ])

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const newThisWeek = await TorModel.countDocuments({ createdAt: { $gte: oneWeekAgo } })

    res.json({
      stats: {
        total_tors: totalTors,
        new_this_week: newThisWeek,
        active_users: activeUsers,
        awarded_projects: awardedCount,
      },
      role_counts: {
        admins: adminCount,
        editors: editorCount,
        users: userCount,
        pending: pendingUsers,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch admin stats', error: (error as Error).message })
  }
}

export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, role, status } = req.query
    const conditions: Record<string, unknown>[] = []

    if (role && role !== 'all') {
      if (role === 'user') {
        conditions.push({ $or: [{ role: 'user' }, { role: { $exists: false } }] })
      } else {
        conditions.push({ role })
      }
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        conditions.push({ $or: [{ status: 'active' }, { status: { $exists: false } }] })
      } else {
        conditions.push({ status })
      }
    }

    if (typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i')
      conditions.push({
        $or: [
          { name: regex },
          { displayName: regex },
          { email: regex },
          { agencyName: regex },
          { companyName: regex },
        ],
      })
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {}

    const docs = await User.find(filter).sort({ createdAt: -1 }).lean()

    const users = docs.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      displayName: u.displayName || u.name,
      email: u.email,
      role: u.role || 'user',
      status: u.status || 'active',
      accountType: u.accountType || 'personal',
      agencyName: u.agencyName,
      companyName: u.companyName,
      jobTitle: u.jobTitle,
      image: u.image ?? null,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      lastActive: 'ออนไลน์ขณะนี้',
    }))

    res.json({ users })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: (error as Error).message })
  }
}

export const getAdminUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params

    if (!isObjectIdOrHexString(userId)) {
      res.status(400).json({ success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' })
      return
    }

    const u = await User.findById(userId).lean()
    if (!u) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' })
      return
    }

    const bookmarkedCount = await UserBookmarkModel.countDocuments({ userId: u._id })

    res.json({
      user: {
        _id: u._id.toString(),
        name: u.name,
        displayName: u.displayName || u.name,
        email: u.email,
        role: u.role || 'user',
        status: u.status || 'active',
        accountType: u.accountType || 'personal',
        agencyName: u.agencyName,
        companyName: u.companyName,
        jobTitle: u.jobTitle,
        firstName: u.firstName,
        lastName: u.lastName,
        contactEmail: u.contactEmail,
        phone: u.phone,
        interests: u.interests ?? [],
        image: u.image ?? null,
        bookmarkedCount,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params
    const { role } = req.body

    if (!isObjectIdOrHexString(userId)) {
      res.status(400).json({ success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' })
      return
    }

    if (!['admin', 'editor', 'user'].includes(role)) {
      res.status(400).json({ success: false, message: 'บทบาทไม่ถูกต้อง' })
      return
    }

    const actorId = req.user!._id
    let outcome = 'not_found' as UserChangeOutcome
    let updated = null as UserDocument | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const target = await User.findById(userId).session(session)
        if (!target) return

        if (target._id.equals(actorId)) {
          outcome = 'self'
          return
        }

        if (
          isActiveAdmin(target) &&
          role !== 'admin' &&
          !(await hasOtherActiveAdmin(target._id, session))
        ) {
          outcome = 'last_admin'
          return
        }

        const previousRole = target.role || 'user'
        updated = await User.findByIdAndUpdate(userId, { role }, { new: true, session })
        if (!updated) return

        await touchActor(actorId, session)
        await createAuditLog(
          {
            actorId,
            action: 'user.role.update',
            targetType: 'user',
            targetId: updated._id,
            before: { role: previousRole },
            after: { role },
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'not_found') {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' })
      return
    }

    if (outcome === 'self') {
      res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้' })
      return
    }

    if (outcome === 'last_admin') {
      res.status(400).json({ success: false, message: 'ไม่สามารถลดสิทธิ์ผู้ดูแลระบบคนสุดท้ายได้' })
      return
    }

    const roleMap: Record<string, string> = {
      admin: 'ผู้ดูแลระบบ (Admin)',
      editor: 'บรรณาธิการ (Editor)',
      user: 'ผู้ใช้งานทั่วไป (User)',
    }

    res.json({
      success: true,
      message: `เปลี่ยนบทบาทเป็น ${roleMap[role]} สำเร็จ`,
      user: updated,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params
    const { status } = req.body

    if (!isObjectIdOrHexString(userId)) {
      res.status(400).json({ success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' })
      return
    }

    if (!['active', 'pending', 'suspended'].includes(status)) {
      res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' })
      return
    }

    const actorId = req.user!._id
    let outcome = 'not_found' as UserChangeOutcome
    let updated = null as UserDocument | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const target = await User.findById(userId).session(session)
        if (!target) return

        if (target._id.equals(actorId)) {
          outcome = 'self'
          return
        }

        if (
          isActiveAdmin(target) &&
          status !== 'active' &&
          !(await hasOtherActiveAdmin(target._id, session))
        ) {
          outcome = 'last_admin'
          return
        }

        const previousStatus = target.status || 'active'
        updated = await User.findByIdAndUpdate(userId, { status }, { new: true, session })
        if (!updated) return

        await touchActor(actorId, session)
        await createAuditLog(
          {
            actorId,
            action: 'user.status.update',
            targetType: 'user',
            targetId: updated._id,
            before: { status: previousStatus },
            after: { status },
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'not_found') {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' })
      return
    }

    if (outcome === 'self') {
      res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะของตัวเองได้' })
      return
    }

    if (outcome === 'last_admin') {
      res
        .status(400)
        .json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะผู้ดูแลระบบคนสุดท้ายได้' })
      return
    }

    const statusMap: Record<string, string> = {
      active: 'ใช้งานอยู่',
      pending: 'รอการอนุมัติ',
      suspended: 'ระงับการใช้งาน',
    }

    res.json({
      success: true,
      message: `ปรับสถานะเป็น ${statusMap[status]} สำเร็จ`,
      user: updated,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

const ACTIVITY_LIMIT = 20

const ACTIVITY_TITLES: Record<string, string> = {
  'user.role.update': 'เปลี่ยนบทบาทผู้ใช้งาน',
  'user.status.update': 'เปลี่ยนสถานะผู้ใช้งาน',
  'tor.update': 'แก้ไขข้อมูล TOR',
  'tor.verify': 'ยืนยันความถูกต้องของ TOR',
  'tor.archive': 'เก็บ TOR เข้าคลัง',
  'tor.delete': 'ลบ TOR',
}

const toActivityType = (action: string): string => {
  if (action.startsWith('user.')) return 'user_role'
  if (action.startsWith('tor.')) return 'tor_update'
  return 'system'
}

const describeChange = (before: unknown, after: unknown): string => {
  const from = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>
  const to = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>
  return Object.keys(to)
    .map((key) => `${key}: ${String(from[key] ?? '-')} → ${String(to[key])}`)
    .join(', ')
}

export const getAdminActivities = async (_req: Request, res: Response): Promise<void> => {
  try {
    const logs = await listRecentAuditLogs(ACTIVITY_LIMIT)
    const userIds = logs.flatMap((log) =>
      log.targetType === 'user' ? [log.actorId, log.targetId] : [log.actorId],
    )
    const users = await User.find({ _id: { $in: userIds } }, { name: 1, displayName: 1, email: 1 })
      .lean()
    const userById = new Map(users.map((u) => [u._id.toString(), u]))
    const torIds = logs.filter((log) => log.targetType === 'tor').map((log) => log.targetId)
    const tors = await TorModel.find({ _id: { $in: torIds } }, { projectTitle: 1 }).lean()
    const torTitleById = new Map(tors.map((tor) => [tor._id.toString(), tor.projectTitle]))

    const activities = logs.map((log) => {
      const actor = userById.get(log.actorId.toString())
      const target =
        log.targetType === 'user'
          ? userById.get(log.targetId.toString())?.email
          : torTitleById.get(log.targetId.toString())

      return {
        id: log._id.toString(),
        title: ACTIVITY_TITLES[log.action] ?? log.action,
        description: describeChange(log.before, log.after),
        type: toActivityType(log.action),
        actor: actor ? actor.displayName || actor.name : 'ไม่ทราบผู้ใช้งาน',
        target: target ?? log.targetId.toString(),
        createdAt: new Date(log.createdAt).toISOString(),
      }
    })

    res.json({ activities })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activities', error: (error as Error).message })
  }
}

// ---------------------------------------------------------------------------
// TOR management (UC-14)
// ---------------------------------------------------------------------------

type AdminTorLean = Tor & { _id: Types.ObjectId }

const TOR_STATUS_TRANSITIONS: Record<'verified' | 'archived' | 'deleted', TorReviewStatus[]> = {
  verified: ['unverified', 'archived'],
  archived: ['unverified', 'verified'],
  deleted: ['unverified', 'verified', 'archived'],
}

const toAdminTorListItem = (tor: AdminTorLean) => {
  const category = deriveCategory(tor.technologies ?? [])
  return {
    id: tor._id.toString(),
    externalId: tor.externalId,
    projectTitle: tor.projectTitle,
    agencyName: tor.agencyName ?? null,
    sourceAdapter: tor.sourceAdapter,
    dataSourceId: tor.dataSourceId.toString(),
    category,
    categoryLabel: CATEGORY_LABELS[category],
    confidence: tor.confidence,
    reviewStatus: tor.reviewStatus ?? 'unverified',
    budgetBaht: tor.budgetBaht ?? null,
    createdAt: tor.createdAt,
    updatedAt: tor.updatedAt,
  }
}

const toAdminTorDetail = (tor: AdminTorLean) => ({
  ...toAdminTorListItem(tor),
  ingestionJobId: tor.ingestionJobId.toString(),
  sourceVersion: tor.sourceVersion,
  detailUrl: tor.detailUrl,
  documents: tor.documents ?? [],
  departmentName: tor.departmentName ?? null,
  departmentSubName: tor.departmentSubName ?? null,
  projectStatus: tor.projectStatus ?? null,
  summary: tor.summary ?? null,
  scope: tor.scope ?? null,
  objectives: tor.objectives ?? [],
  requirements: tor.requirements ?? [],
  technologies: tor.technologies ?? [],
  bidderQualifications: tor.bidderQualifications ?? [],
  deliverables: tor.deliverables ?? [],
  timeline: tor.timeline ?? [],
  evaluationCriteria: tor.evaluationCriteria ?? [],
  midPriceBaht: tor.midPriceBaht ?? null,
  awardedPriceBaht: tor.awardedPriceBaht ?? null,
  submissionDeadline: tor.submissionDeadline ?? null,
  contactInformation: tor.contactInformation ?? [],
  classificationReason: tor.classificationReason,
  analysisModel: tor.analysisModel,
  analysisVersion: tor.analysisVersion,
  analyzedAt: tor.analyzedAt,
})

export const getAdminTors = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = adminTorListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
      return
    }

    const {
      q,
      status,
      category,
      confidence_min: confidenceMin,
      confidence_max: confidenceMax,
      data_source_id: dataSourceId,
      date_from: dateFrom,
      date_to: dateTo,
      page,
      page_size: pageSize,
    } = parsed.data

    const filter: Record<string, unknown> = {}
    if (status === 'all') {
      filter.reviewStatus = { $ne: 'deleted' }
    } else if (status === 'unverified') {
      filter.reviewStatus = { $in: ['unverified', null] }
    } else {
      filter.reviewStatus = status
    }
    if (q) filter.projectTitle = { $regex: escapeRegex(q), $options: 'i' }
    if (confidenceMin !== undefined || confidenceMax !== undefined) {
      const confidence: Record<string, number> = {}
      if (confidenceMin !== undefined) confidence.$gte = confidenceMin
      if (confidenceMax !== undefined) confidence.$lte = confidenceMax
      filter.confidence = confidence
    }
    if (dataSourceId) filter.dataSourceId = dataSourceId
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.$gte = dateFrom
      if (dateTo) createdAt.$lte = dateTo
      filter.createdAt = createdAt
    }

    const docs = await TorModel.find(filter).sort({ createdAt: -1 }).lean()
    const items = docs
      .map(toAdminTorListItem)
      .filter((item) => !category || item.category === category)

    const total = items.length
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
    const tors = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

    res.json({ tors, total, page, totalPages })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const getAdminTorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torId } = req.params

    if (!isObjectIdOrHexString(torId)) {
      res.status(400).json({ success: false, message: 'รหัส TOR ไม่ถูกต้อง' })
      return
    }

    const tor = await TorModel.findById(torId).lean()
    if (!tor) {
      res.status(404).json({ success: false, message: 'ไม่พบ TOR' })
      return
    }

    res.json({ tor: toAdminTorDetail(tor) })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const updateAdminTor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torId } = req.params

    if (!isObjectIdOrHexString(torId)) {
      res.status(400).json({ success: false, message: 'รหัส TOR ไม่ถูกต้อง' })
      return
    }

    const parsed = updateAdminTorSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'ข้อมูลที่แก้ไขไม่ถูกต้อง' })
      return
    }

    const changes = parsed.data
    const actorId = req.user!._id
    let outcome = 'not_found' as TorChangeOutcome
    let updated = null as AdminTorLean | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const tor = await TorModel.findById(torId).session(session).lean()
        if (!tor) return

        if (tor.reviewStatus === 'deleted') {
          outcome = 'deleted'
          return
        }

        const current = tor as unknown as Record<string, unknown>
        const before = Object.fromEntries(
          Object.keys(changes).map((key) => [key, current[key] ?? null]),
        )

        updated = await TorModel.findByIdAndUpdate(
          torId,
          { $set: changes },
          { new: true, runValidators: true, session },
        ).lean()
        if (!updated) return

        await createAuditLog(
          {
            actorId,
            action: 'tor.update',
            targetType: 'tor',
            targetId: updated._id,
            before,
            after: changes,
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'deleted') {
      res.status(400).json({ success: false, message: 'TOR นี้ถูกลบแล้ว' })
      return
    }

    if (outcome === 'not_found' || !updated) {
      res.status(404).json({ success: false, message: 'ไม่พบ TOR' })
      return
    }

    res.json({ success: true, message: 'แก้ไขข้อมูล TOR สำเร็จ', tor: toAdminTorDetail(updated) })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

const changeTorReviewStatus = async (
  req: Request,
  res: Response,
  nextStatus: 'verified' | 'archived' | 'deleted',
  action: string,
  successMessage: string,
): Promise<void> => {
  try {
    const { torId } = req.params

    if (!isObjectIdOrHexString(torId)) {
      res.status(400).json({ success: false, message: 'รหัส TOR ไม่ถูกต้อง' })
      return
    }

    const actorId = req.user!._id
    let outcome = 'not_found' as TorChangeOutcome
    let previousStatus = 'unverified' as TorReviewStatus

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const tor = await TorModel.findById(torId).session(session).lean()
        if (!tor) return

        previousStatus = tor.reviewStatus ?? 'unverified'
        if (previousStatus === 'deleted') {
          outcome = 'deleted'
          return
        }

        if (!TOR_STATUS_TRANSITIONS[nextStatus].includes(previousStatus)) {
          outcome = 'invalid_transition'
          return
        }

        await TorModel.updateOne(
          { _id: tor._id },
          { $set: { reviewStatus: nextStatus } },
          { session },
        )
        await createAuditLog(
          {
            actorId,
            action,
            targetType: 'tor',
            targetId: tor._id,
            before: { reviewStatus: previousStatus },
            after: { reviewStatus: nextStatus },
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'not_found') {
      res.status(404).json({ success: false, message: 'ไม่พบ TOR' })
      return
    }

    if (outcome === 'deleted') {
      res.status(400).json({ success: false, message: 'TOR นี้ถูกลบแล้ว' })
      return
    }

    if (outcome === 'invalid_transition') {
      res.status(400).json({
        success: false,
        message: `ไม่สามารถเปลี่ยนสถานะจาก ${previousStatus} เป็น ${nextStatus} ได้`,
      })
      return
    }

    res.json({ success: true, message: successMessage, reviewStatus: nextStatus })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const verifyAdminTor = (req: Request, res: Response): Promise<void> =>
  changeTorReviewStatus(req, res, 'verified', 'tor.verify', 'ยืนยันความถูกต้องของ TOR สำเร็จ')

export const archiveAdminTor = (req: Request, res: Response): Promise<void> =>
  changeTorReviewStatus(req, res, 'archived', 'tor.archive', 'เก็บ TOR เข้าคลังสำเร็จ')

export const deleteAdminTor = (req: Request, res: Response): Promise<void> =>
  changeTorReviewStatus(req, res, 'deleted', 'tor.delete', 'ลบ TOR สำเร็จ')
