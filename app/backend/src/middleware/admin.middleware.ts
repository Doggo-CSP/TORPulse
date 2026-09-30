import type { Request, Response, NextFunction } from 'express'

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' })
    return
  }

  if (req.user.role !== 'admin' || (req.user.status && req.user.status !== 'active')) {
    res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ' })
    return
  }

  next()
}
