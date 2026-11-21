import type { Request, Response, NextFunction, RequestHandler } from 'express'

import { missingScopes, type Role, type Scope } from '../modules/auth/scopes.js'

const LOGIN_REQUIRED = 'กรุณาเข้าสู่ระบบ'

// Allows only the given roles, and only for accounts whose status is active (or unset on
// records created before status existed).
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: LOGIN_REQUIRED })
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

// Any active, logged-in account.
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: LOGIN_REQUIRED })
    return
  }

  if (req.user.status === 'suspended') {
    res.status(403).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' })
    return
  }

  next()
}

// Allows the request only when the account's role grants every listed scope.
export const requireScope =
  (...scopes: Scope[]): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: LOGIN_REQUIRED })
      return
    }

    const missing = missingScopes(req.user, scopes)
    if (missing.length > 0) {
      res.status(403).json({
        success: false,
        message: 'ไม่มีสิทธิ์ดำเนินการนี้',
        missingScopes: missing,
      })
      return
    }

    next()
  }
