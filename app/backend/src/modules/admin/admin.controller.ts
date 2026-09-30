import type { Request, Response } from 'express'
import mongoose, { isObjectIdOrHexString, type ClientSession, type Types } from 'mongoose'
import { User, type UserDocument } from '../auth/user.model.js'
import { TorModel } from '../tor/tor.model.js'
import { UserBookmarkModel } from '../user/user-bookmark.model.js'
import type { UserChangeOutcome } from './admin.types.js'
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

    const activities = logs.map((log) => {
      const actor = userById.get(log.actorId.toString())
      const target = log.targetType === 'user' ? userById.get(log.targetId.toString()) : undefined

      return {
        id: log._id.toString(),
        title: ACTIVITY_TITLES[log.action] ?? log.action,
        description: describeChange(log.before, log.after),
        type: toActivityType(log.action),
        actor: actor ? actor.displayName || actor.name : 'ไม่ทราบผู้ใช้งาน',
        target: target?.email ?? log.targetId.toString(),
        createdAt: new Date(log.createdAt).toISOString(),
      }
    })

    res.json({ activities })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activities', error: (error as Error).message })
  }
}
