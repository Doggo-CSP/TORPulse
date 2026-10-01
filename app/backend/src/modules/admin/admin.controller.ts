import type { Request, Response } from 'express'
import { User } from '../auth/user.model.js'
import { TorModel } from '../tor/tor.model.js'

export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalUsers, activeUsers, pendingUsers, adminCount, userCount, totalTors, awardedCount] =
      await Promise.all([
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
        pending: pendingUsers,
      },
    })
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Failed to fetch admin stats', error: (error as Error).message })
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
      const regex = new RegExp(q.trim(), 'i')
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

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params
    const { role } = req.body

    if (!['admin', 'user'].includes(role)) {
      res.status(400).json({ success: false, message: 'บทบาทไม่ถูกต้อง' })
      return
    }

    const updated = await User.findByIdAndUpdate(userId, { role }, { new: true })
    if (!updated) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' })
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

    if (!['active', 'pending', 'suspended'].includes(status)) {
      res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' })
      return
    }

    const updated = await User.findByIdAndUpdate(userId, { status }, { new: true })
    if (!updated) {
      res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' })
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

export const getAdminActivities = async (_req: Request, res: Response): Promise<void> => {
  try {
    const recentUsers = await User.find().sort({ updatedAt: -1 }).limit(10).lean()
    const activities = recentUsers.map((u, i) => ({
      id: `act-${u._id}-${i}`,
      title: `ผู้ใช้งาน ${u.displayName || u.name} (${u.role || 'user'})`,
      description: `สถานะ: ${u.status || 'active'} | เข้าสู่ระบบล่าสุดผ่าน Google OAuth`,
      type: 'user_role',
      actor: 'System',
      target: u.email,
      createdAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
    }))

    res.json({ activities })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activities', error: (error as Error).message })
  }
}
