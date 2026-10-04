import { randomUUID } from 'node:crypto'

import type { Request, Response } from 'express'
import {
  beginGovSpendingSync,
  completeGovSpendingSync,
} from '../../apps/queue-producer/queue-producer.js'
import { env } from '../../config/env.js'
import { GovSpendingDiscoveryAdapter } from '../ingestion/adapters/govspending-discovery.adapter.js'
import { getBangkokWeekRange } from '../homepage/homepage.controller.js'
import {
  expireStaleCollectionRuns,
  findLatestCollectionRun,
  hasRunningCollectionRun,
  staleRunCutoff,
} from '../ingestion/collection-run.repository.js'
import { IngestionJobModel } from '../ingestion/ingestion-job.model.js'
import mongoose, { isObjectIdOrHexString, type ClientSession, type Types } from 'mongoose'
import { User, type UserDocument } from '../auth/user.model.js'
import { CategoryModel } from '../category/category.model.js'
import {
  countUsersByCategory,
  generateCategoryKey,
  getCategoryNameMap,
  listCategories,
  nextCategorySortOrder,
  normalizeKeywords,
} from '../category/category.repository.js'
import { deriveCategory, resolveTorCategory } from '../tor/tor.controller.js'
import { TorModel, type Tor, type TorReviewStatus } from '../tor/tor.model.js'
import { UserBookmarkModel } from '../user/user-bookmark.model.js'
import type {
  CategoryChangeOutcome,
  SystemSettings,
  TorChangeOutcome,
  UserChangeOutcome,
} from './admin.types.js'
import {
  activityQuerySchema,
  adminCategoryListQuerySchema,
  adminTorListQuerySchema,
  categoryStatusSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAdminTorSchema,
  updateAdminUserSchema,
  updateSettingsSchema,
} from './admin.validation.js'
import { activityGroupOf, createAuditLog, listAuditLogs } from './audit-log.repository.js'
import { getSettings, updateSettings } from './settings.repository.js'

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
      userCount,
      totalTors,
      awardedCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ $or: [{ status: 'active' }, { status: { $exists: false } }] }),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ $or: [{ role: 'user' }, { role: { $exists: false } }] }),
      TorModel.countDocuments(),
      TorModel.countDocuments({ awardedPriceBaht: { $ne: null } }),
    ])

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const newThisWeek = await TorModel.countDocuments({ createdAt: { $gte: oneWeekAgo } })

    // Numbers for the current admin pages. `stats` / `role_counts` above are kept unchanged
    // for the existing frontend until it moves to these keys.
    const notDeleted = { reviewStatus: { $ne: 'deleted' as const } }
    const { start: weekStart, end: weekEnd } = getBangkokWeekRange(new Date())
    const [torsTotal, torsNewThisWeek, torsAwarded, suspendedUsers, savedTors, jobStatusRows] =
      await Promise.all([
        TorModel.countDocuments(notDeleted),
        // TORs have no announcement date yet, so the date they entered the system is used.
        // Storing the e-GP announcement date is future work.
        TorModel.countDocuments({ ...notDeleted, createdAt: { $gte: weekStart, $lt: weekEnd } }),
        // A TOR counts as awarded once the source reports an agreed (winning) price
        TorModel.countDocuments({ ...notDeleted, awardedPriceBaht: { $ne: null } }),
        User.countDocuments({ status: 'suspended' }),
        UserBookmarkModel.countDocuments(),
        IngestionJobModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ])
    const jobsByStatus = Object.fromEntries(jobStatusRows.map((row) => [row._id, row.count]))

    res.json({
      stats: {
        total_tors: totalTors,
        new_this_week: newThisWeek,
        active_users: activeUsers,
        awarded_projects: awardedCount,
      },
      role_counts: {
        admins: adminCount,
        users: userCount,
      },
      tors: {
        total: torsTotal,
        newThisWeek: torsNewThisWeek,
        awarded: torsAwarded,
      },
      users: {
        total: totalUsers,
        byRole: { admin: adminCount, user: userCount },
        byStatus: { active: activeUsers, suspended: suspendedUsers },
      },
      savedTors: { total: savedTors },
      ingestionJobs: {
        queued: jobsByStatus.queued ?? 0,
        processing: jobsByStatus.processing ?? 0,
        completed: jobsByStatus.completed ?? 0,
        failed: jobsByStatus.failed ?? 0,
        rejected: jobsByStatus.rejected ?? 0,
        reviewRequired: jobsByStatus.review_required ?? 0,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch admin stats', error: (error as Error).message })
  }
}

export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, status } = req.query
    // `q` is the older name the current admin page still sends
    const q = req.query.search ?? req.query.q
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

    res.json({ users, total: users.length })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: (error as Error).message })
  }
}

export const updateAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params

    if (!isObjectIdOrHexString(userId)) {
      res.status(400).json({ success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' })
      return
    }

    const parsed = updateAdminUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'ข้อมูลที่แก้ไขไม่ถูกต้อง' })
      return
    }

    const changes = parsed.data
    const actorId = req.user!._id
    let updated = null as UserDocument | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const target = await User.findById(userId).session(session).lean()
        if (!target) {
          updated = null
          return
        }

        const current = target as unknown as Record<string, unknown>
        const before = Object.fromEntries(
          Object.keys(changes).map((key) => [key, current[key] ?? null]),
        )

        updated = await User.findByIdAndUpdate(
          userId,
          { $set: changes },
          { new: true, runValidators: true, session },
        )
        if (!updated) return

        await createAuditLog(
          {
            actorId,
            action: 'user.updated',
            targetType: 'user',
            targetId: updated._id,
            actorName: req.user!.name,
            targetLabel: updated.name,
            before,
            after: changes,
          },
          session,
        )
      })
    } finally {
      await session.endSession()
    }

    if (!updated) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' })
      return
    }

    res.json({ success: true, message: 'แก้ไขข้อมูลผู้ใช้งานสำเร็จ', user: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
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

    if (!['admin', 'user'].includes(role)) {
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
        if (previousRole === role) {
          outcome = 'unchanged'
          return
        }

        updated = await User.findByIdAndUpdate(userId, { role }, { new: true, session })
        if (!updated) return

        await touchActor(actorId, session)
        await createAuditLog(
          {
            actorId,
            action: 'user.role_changed',
            targetType: 'user',
            targetId: updated._id,
            actorName: req.user!.name,
            targetLabel: updated.name,
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

    if (outcome === 'unchanged') {
      res.status(400).json({ success: false, message: 'ผู้ใช้งานมีบทบาทนี้อยู่แล้ว' })
      return
    }

    const roleMap: Record<string, string> = {
      admin: 'ผู้ดูแลระบบ (Admin)',
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

    // Admins can suspend (active -> suspended) and reactivate (suspended -> active).
    if (!['active', 'suspended'].includes(status)) {
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
        if (previousStatus === status) {
          outcome = 'unchanged'
          return
        }

        const action = status === 'suspended' ? 'user.suspended' : 'user.reactivated'

        updated = await User.findByIdAndUpdate(userId, { status }, { new: true, session })
        if (!updated) return

        await touchActor(actorId, session)
        await createAuditLog(
          {
            actorId,
            action,
            targetType: 'user',
            targetId: updated._id,
            actorName: req.user!.name,
            targetLabel: updated.name,
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

    if (outcome === 'unchanged') {
      res.status(400).json({ success: false, message: 'ผู้ใช้งานมีสถานะนี้อยู่แล้ว' })
      return
    }

    const statusMap: Record<string, string> = {
      active: 'ใช้งานอยู่',
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

// ---------------------------------------------------------------------------
// GET /api/v1/admin/activity
// ---------------------------------------------------------------------------

// One log row is one feed item; the backend never merges events ("approved 2 accounts").
// The frontend builds the Thai sentence from `action` and `metadata`.
const toFieldChanges = (before: unknown, after: unknown) => {
  if (!after || typeof after !== 'object') return undefined
  const from = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(after as Record<string, unknown>).map(([field, to]) => [
      field,
      { from: from[field] ?? null, to },
    ]),
  )
}

export const getAdminActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = activityQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
      return
    }

    const { page, limit, group } = parsed.data
    const { items: logs, total } = await listAuditLogs({ page, limit, group })

    const items = logs.map((log) => {
      const changes = toFieldChanges(log.before, log.after)
      return {
        id: log._id.toString(),
        action: log.action,
        group: activityGroupOf(log.action),
        actor:
          log.actorType === 'system'
            ? { type: 'system' }
            : { type: 'user', id: log.actorId?.toString() ?? null, name: log.actorName ?? null },
        target: {
          type: log.targetType,
          id: log.targetId.toString(),
          label: log.targetLabel ?? null,
        },
        metadata: {
          ...((log.metadata as Record<string, unknown> | null) ?? {}),
          ...(changes ? { changes } : {}),
        },
        createdAt: new Date(log.createdAt).toISOString(),
      }
    })

    res.json({ items, total, page, limit })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
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

// categoryNames: key -> name from getCategoryNameMap(); an unknown key is shown as the key itself
const toAdminTorListItem = (tor: AdminTorLean, categoryNames: Map<string, string>) => {
  const category = resolveTorCategory(tor)
  return {
    id: tor._id.toString(),
    externalId: tor.externalId,
    projectTitle: tor.projectTitle,
    agencyName: tor.agencyName ?? null,
    sourceAdapter: tor.sourceAdapter,
    dataSourceId: tor.dataSourceId.toString(),
    category,
    categoryLabel: categoryNames.get(category) ?? category,
    confidence: tor.confidence,
    reviewStatus: tor.reviewStatus ?? 'unverified',
    // The table shows the budget, falling back to the mid (reference) price when it is missing
    budgetBaht: tor.budgetBaht ?? tor.midPriceBaht ?? null,
    budgetSource: tor.budgetBaht != null ? 'budget' : tor.midPriceBaht != null ? 'mid_price' : null,
    createdAt: tor.createdAt,
    updatedAt: tor.updatedAt,
  }
}

const toAdminTorDetail = (tor: AdminTorLean, categoryNames: Map<string, string>) => {
  // The detail feeds the edit form, so it returns the stored budget without the list fallback
  const { budgetSource: _budgetSource, ...listFields } = toAdminTorListItem(tor, categoryNames)
  return {
    ...listFields,
    budgetBaht: tor.budgetBaht ?? null,
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
  }
}

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

    const [docs, categoryNames] = await Promise.all([
      TorModel.find(filter).sort({ createdAt: -1 }).lean(),
      getCategoryNameMap(),
    ])
    const items = docs
      .map((tor) => toAdminTorListItem(tor, categoryNames))
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

    res.json({ tor: toAdminTorDetail(tor, await getCategoryNameMap()) })
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
    // Only an active category can be assigned; TORs already on a hidden one keep it.
    if (
      changes.category &&
      !(await CategoryModel.exists({ key: changes.category, isActive: true }))
    ) {
      res.status(400).json({ success: false, message: 'ไม่พบหมวดหมู่ หรือหมวดหมู่ถูกซ่อนอยู่' })
      return
    }

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

        const current: Record<string, unknown> = {
          ...(tor as unknown as Record<string, unknown>),
          category: resolveTorCategory(tor),
        }
        const before = Object.fromEntries(
          Object.keys(changes).map((key) => [key, current[key] ?? null]),
        )

        // An explicit category pins it; otherwise new technologies re-derive it unless an
        // admin pinned it earlier. lastEditedAt stops ingestion from overwriting the edit.
        const update: Record<string, unknown> = { ...changes, lastEditedAt: new Date() }
        if (changes.category) {
          update.categoryOverridden = true
        } else if (changes.technologies && !tor.categoryOverridden) {
          update.category = deriveCategory(changes.technologies)
        }

        updated = await TorModel.findByIdAndUpdate(
          torId,
          { $set: update },
          { new: true, runValidators: true, session },
        ).lean()
        if (!updated) return

        await createAuditLog(
          {
            actorId,
            action: 'tor.updated',
            targetType: 'tor',
            targetId: updated._id,
            actorName: req.user!.name,
            targetLabel: updated.externalId,
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

    res.json({
      success: true,
      message: 'แก้ไขข้อมูล TOR สำเร็จ',
      tor: toAdminTorDetail(updated, await getCategoryNameMap()),
    })
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
            actorName: req.user!.name,
            targetLabel: tor.externalId,
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
  changeTorReviewStatus(req, res, 'verified', 'tor.verified', 'ยืนยันความถูกต้องของ TOR สำเร็จ')

export const archiveAdminTor = (req: Request, res: Response): Promise<void> =>
  changeTorReviewStatus(req, res, 'archived', 'tor.archived', 'เก็บ TOR เข้าคลังสำเร็จ')

export const deleteAdminTor = (req: Request, res: Response): Promise<void> =>
  changeTorReviewStatus(req, res, 'deleted', 'tor.deleted', 'ลบ TOR สำเร็จ')

// ---------------------------------------------------------------------------
// e-GP sync: GET /admin/ingestion/status, POST /admin/ingestion/sync
// ---------------------------------------------------------------------------

type CollectionRunLean = NonNullable<Awaited<ReturnType<typeof findLatestCollectionRun>>>

const toRunResponse = (run: CollectionRunLean) => ({
  id: run._id.toString(),
  trigger: run.trigger,
  triggeredBy: run.triggeredBy ? run.triggeredBy.toString() : null,
  status: run.status,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt ?? null,
  fetchedCount: run.fetchedCount,
  createdCount: run.createdCount,
  existingCount: run.existingCount,
  errorMessage: run.errorMessage ?? null,
})

export const getIngestionStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    await expireStaleCollectionRuns({ olderThan: staleRunCutoff() })
    const [lastRun, isRunning] = await Promise.all([
      findLatestCollectionRun(),
      hasRunningCollectionRun(),
    ])

    res.json({ lastRun: lastRun ? toRunResponse(lastRun) : null, isRunning })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const triggerIngestionSync = async (req: Request, res: Response): Promise<void> => {
  try {
    // The sync runs in this API process. That is fine because the API is a long-running
    // Express server (apps/api/server.ts); there is no serverless deploy. If it ever moves
    // to a scale-to-zero platform, record the request instead and let queue-producer run it.
    // The API then also needs GOVSPENDING_API_KEY.
    if (!env.GOVSPENDING_API_KEY) {
      res.status(503).json({ success: false, message: 'ยังไม่ได้ตั้งค่า GOVSPENDING_API_KEY' })
      return
    }

    const producerId = `manual-sync-${randomUUID()}`
    const trigger = {
      trigger: 'manual' as const,
      triggeredBy: req.user!._id,
      triggeredByName: req.user!.name,
    }

    // The lease is the same one the scheduled producer uses, so a scheduled run and a
    // manual run can never overlap, even across processes.
    const claim = await beginGovSpendingSync(producerId, trigger)
    if (!claim) {
      res.status(409).json({ success: false, message: 'มีการซิงก์ข้อมูลที่กำลังทำงานอยู่' })
      return
    }

    const adapter = new GovSpendingDiscoveryAdapter({ apiKey: env.GOVSPENDING_API_KEY })
    void completeGovSpendingSync(
      claim,
      producerId,
      adapter,
      new AbortController().signal,
      trigger,
    ).catch((error: unknown) => {
      console.error('Manual GovSpending sync failed', error)
    })

    res.status(202).json({
      success: true,
      message: 'เริ่มซิงก์ข้อมูล e-GP แล้ว',
      runId: claim.runId.toString(),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

// The producer's sync interval comes from env and needs an infrastructure change to edit,
// so it is reported read-only next to the editable settings.
const toSettingsResponse = (settings: SystemSettings) => ({
  ...settings,
  ingestionIntervalMinutes: env.GOVSPENDING_SYNC_INTERVAL_MS / 60_000,
})

export const getAdminSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ settings: toSettingsResponse(await getSettings()) })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const updateAdminSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' })
      return
    }

    const changes = parsed.data
    const actorId = req.user!._id
    let saved = null as SystemSettings | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const current = (await getSettings(session)) as unknown as Record<string, unknown>
        const before = Object.fromEntries(
          Object.keys(changes).map((key) => [key, current[key] ?? null]),
        )

        const doc = await updateSettings(changes, session)
        if (!doc) return

        await createAuditLog(
          {
            actorId,
            action: 'settings.updated',
            targetType: 'settings',
            targetId: doc._id,
            actorName: req.user!.name,
            targetLabel: 'ตั้งค่าระบบ',
            before,
            after: changes,
          },
          session,
        )
        saved = await getSettings(session)
      })
    } finally {
      await session.endSession()
    }

    if (!saved) {
      res.status(500).json({ success: false, message: 'บันทึกการตั้งค่าไม่สำเร็จ' })
      return
    }

    res.json({
      success: true,
      message: 'บันทึกการตั้งค่าสำเร็จ',
      settings: toSettingsResponse(saved),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

// ---------------------------------------------------------------------------
// Categories (UC-16): /admin/categories
// ---------------------------------------------------------------------------

type CategoryLean = Awaited<ReturnType<typeof listCategories>>[number]

const toAdminCategory = (category: CategoryLean, userCount: number) => ({
  id: category._id.toString(),
  key: category.key,
  name: category.name,
  description: category.description ?? '',
  keywords: category.keywords ?? [],
  isActive: category.isActive,
  sortOrder: category.sortOrder,
  userCount,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
})

const categoryAuditFields = (category: CategoryLean) => ({
  name: category.name,
  description: category.description ?? '',
  keywords: category.keywords ?? [],
  isActive: category.isActive,
})

// Names are unique regardless of letter case ("AI" and "ai" are the same category).
const categoryNameTaken = async (
  name: string,
  session: ClientSession,
  excludeId?: Types.ObjectId,
): Promise<boolean> => {
  const filter: Record<string, unknown> = {
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  }
  if (excludeId) filter._id = { $ne: excludeId }
  return Boolean(await CategoryModel.exists(filter).session(session))
}

// TORs that show this category: a stored category, or no stored category and the keyword rules
// derive this key (same as resolveTorCategory). Soft-deleted TORs still hold the key, so they count.
const countTorsUsingCategory = async (key: string, session: ClientSession): Promise<number> => {
  const [stored, unstored] = await Promise.all([
    TorModel.countDocuments({ category: key }, { session }),
    TorModel.find({ category: null }, { technologies: 1 }).session(session).lean(),
  ])
  return stored + unstored.filter((tor) => deriveCategory(tor.technologies ?? []) === key).length
}

export const getAdminCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = adminCategoryListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
      return
    }

    // total and activeCount cover every category, so the page's summary does not change with
    // the search box; categories is the filtered list.
    const [categories, userCounts, total, activeCount] = await Promise.all([
      listCategories({ search: parsed.data.search }),
      countUsersByCategory(),
      CategoryModel.countDocuments(),
      CategoryModel.countDocuments({ isActive: true }),
    ])

    res.json({
      categories: categories.map((category) =>
        toAdminCategory(category, userCounts.get(category.key) ?? 0),
      ),
      total,
      activeCount,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const createAdminCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'ข้อมูลหมวดหมู่ไม่ถูกต้อง' })
      return
    }

    const input = parsed.data
    const actorId = req.user!._id
    let outcome = 'not_found' as CategoryChangeOutcome
    let created = null as CategoryLean | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        created = null
        if (await categoryNameTaken(input.name, session)) {
          outcome = 'duplicate_name'
          return
        }
        if (input.key && (await CategoryModel.exists({ key: input.key }).session(session))) {
          outcome = 'duplicate_key'
          return
        }

        const [doc] = await CategoryModel.create(
          [
            {
              key: input.key ?? (await generateCategoryKey(input.name, session)),
              name: input.name,
              description: input.description ?? '',
              keywords: normalizeKeywords(input.keywords ?? []),
              isActive: true,
              sortOrder: await nextCategorySortOrder(session),
            },
          ],
          { session },
        )
        created = doc!.toObject() as CategoryLean

        await createAuditLog(
          {
            actorId,
            action: 'category.created',
            targetType: 'category',
            targetId: created._id,
            actorName: req.user!.name,
            targetLabel: created.name,
            after: { key: created.key, ...categoryAuditFields(created) },
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'duplicate_name') {
      res.status(409).json({ success: false, message: 'มีหมวดหมู่ชื่อนี้อยู่แล้ว' })
      return
    }
    if (outcome === 'duplicate_key') {
      res.status(409).json({ success: false, message: 'มีหมวดหมู่ที่ใช้ key นี้อยู่แล้ว' })
      return
    }
    if (!created) {
      res.status(500).json({ success: false, message: 'เพิ่มหมวดหมู่ไม่สำเร็จ' })
      return
    }

    res.status(201).json({
      success: true,
      message: 'เพิ่มหมวดหมู่สำเร็จ',
      category: toAdminCategory(created, 0),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

export const updateAdminCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params

    if (!isObjectIdOrHexString(categoryId)) {
      res.status(400).json({ success: false, message: 'รหัสหมวดหมู่ไม่ถูกต้อง' })
      return
    }

    // .strict() rejects key (and anything else not editable)
    const parsed = updateCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'ข้อมูลหมวดหมู่ไม่ถูกต้อง (แก้ไขได้เฉพาะชื่อ คำอธิบาย และคีย์เวิร์ด)',
      })
      return
    }

    const changes = {
      ...parsed.data,
      ...(parsed.data.keywords ? { keywords: normalizeKeywords(parsed.data.keywords) } : {}),
    }
    const actorId = req.user!._id
    let outcome = 'not_found' as CategoryChangeOutcome
    let updated = null as CategoryLean | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const category = await CategoryModel.findById(categoryId).session(session).lean()
        if (!category) return

        if (changes.name && (await categoryNameTaken(changes.name, session, category._id))) {
          outcome = 'duplicate_name'
          return
        }

        const current = categoryAuditFields(category) as Record<string, unknown>
        const before = Object.fromEntries(Object.keys(changes).map((key) => [key, current[key]]))

        updated = await CategoryModel.findByIdAndUpdate(
          categoryId,
          { $set: changes },
          { returnDocument: 'after', runValidators: true, session },
        ).lean()
        if (!updated) return

        await createAuditLog(
          {
            actorId,
            action: 'category.updated',
            targetType: 'category',
            targetId: updated._id,
            actorName: req.user!.name,
            targetLabel: updated.name,
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

    if (outcome === 'duplicate_name') {
      res.status(409).json({ success: false, message: 'มีหมวดหมู่ชื่อนี้อยู่แล้ว' })
      return
    }
    if (outcome === 'not_found' || !updated) {
      res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่' })
      return
    }

    const userCounts = await countUsersByCategory()
    res.json({
      success: true,
      message: 'แก้ไขหมวดหมู่สำเร็จ',
      category: toAdminCategory(updated, userCounts.get((updated as CategoryLean).key) ?? 0),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

// Hiding keeps every existing reference: users keep the interest and TORs keep the category;
// the category just stops being offered for new choices.
export const setAdminCategoryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params

    if (!isObjectIdOrHexString(categoryId)) {
      res.status(400).json({ success: false, message: 'รหัสหมวดหมู่ไม่ถูกต้อง' })
      return
    }

    const parsed = categoryStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' })
      return
    }

    const { isActive } = parsed.data
    const actorId = req.user!._id
    let outcome = 'not_found' as CategoryChangeOutcome
    let updated = null as CategoryLean | null

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const category = await CategoryModel.findById(categoryId).session(session).lean()
        if (!category) return

        if (category.isActive === isActive) {
          outcome = 'unchanged'
          return
        }

        updated = await CategoryModel.findByIdAndUpdate(
          categoryId,
          { $set: { isActive } },
          { returnDocument: 'after', session },
        ).lean()
        if (!updated) return

        await createAuditLog(
          {
            actorId,
            action: isActive ? 'category.shown' : 'category.hidden',
            targetType: 'category',
            targetId: updated._id,
            actorName: req.user!.name,
            targetLabel: updated.name,
            before: { isActive: category.isActive },
            after: { isActive },
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'not_found') {
      res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่' })
      return
    }
    if (outcome === 'unchanged' || !updated) {
      res.status(400).json({
        success: false,
        message: isActive ? 'หมวดหมู่นี้แสดงอยู่แล้ว' : 'หมวดหมู่นี้ถูกซ่อนอยู่แล้ว',
      })
      return
    }

    const userCounts = await countUsersByCategory()
    res.json({
      success: true,
      message: isActive ? 'แสดงหมวดหมู่สำเร็จ' : 'ซ่อนหมวดหมู่สำเร็จ',
      category: toAdminCategory(updated, userCounts.get((updated as CategoryLean).key) ?? 0),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}

// Only a category nobody uses can be deleted; otherwise the admin is told to hide it.
export const deleteAdminCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params

    if (!isObjectIdOrHexString(categoryId)) {
      res.status(400).json({ success: false, message: 'รหัสหมวดหมู่ไม่ถูกต้อง' })
      return
    }

    const actorId = req.user!._id
    let outcome = 'not_found' as CategoryChangeOutcome
    let usage = { userCount: 0, torCount: 0 }

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        outcome = 'not_found'
        const category = await CategoryModel.findById(categoryId).session(session).lean()
        if (!category) return

        const [userCount, torCount] = await Promise.all([
          User.countDocuments({ interests: category.key }, { session }),
          countTorsUsingCategory(category.key, session),
        ])
        usage = { userCount, torCount }
        if (userCount > 0 || torCount > 0) {
          outcome = 'in_use'
          return
        }

        await CategoryModel.deleteOne({ _id: category._id }, { session })
        await createAuditLog(
          {
            actorId,
            action: 'category.deleted',
            targetType: 'category',
            targetId: category._id,
            actorName: req.user!.name,
            targetLabel: category.name,
            before: { key: category.key, ...categoryAuditFields(category) },
          },
          session,
        )
        outcome = 'updated'
      })
    } finally {
      await session.endSession()
    }

    if (outcome === 'not_found') {
      res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่' })
      return
    }
    if (outcome === 'in_use') {
      const reasons = [
        usage.userCount > 0 ? `มีผู้ใช้เลือกหมวดหมู่นี้ ${usage.userCount} คน` : null,
        usage.torCount > 0 ? `มี TOR ใช้อยู่ ${usage.torCount} รายการ` : null,
      ].filter(Boolean)
      res.status(409).json({
        success: false,
        message: `ลบไม่ได้ เพราะ${reasons.join(' และ')} กรุณาซ่อนหมวดหมู่แทน`,
        ...usage,
      })
      return
    }

    res.json({ success: true, message: 'ลบหมวดหมู่สำเร็จ' })
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message })
  }
}
