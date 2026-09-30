import type { Request, Response, NextFunction, RequestHandler } from 'express'

type Role = 'admin' | 'editor' | 'user'

// Allows only the given roles, and only for accounts whose status is active (or unset on
// records created before status existed).
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' })
      return
    }

    const role = req.user.role ?? 'user'
    if (!roles.includes(role) || req.user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ' })
      return
    }

    next()
  }

export const requireAdmin = requireRole('admin')
