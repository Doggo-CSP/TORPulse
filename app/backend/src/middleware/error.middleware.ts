import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'

import { logger } from '../lib/logger.js'
import { requestContext } from './request-log.middleware.js'

const GENERIC_ERROR = 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่ภายหลัง'

export const notFoundHandler = (req: Request, res: Response): void => {
  // The path is not echoed back, so the response cannot reflect attacker-controlled text
  res.status(404).json({ success: false, message: 'Not Found' })
}

// Logs the full error with the request context and answers with a generic message and the
// request id only (ASVS V16.5.1). The id lets support find the log entry without exposing
// stack traces, queries or internal messages to the client.
export const respondServerError = (req: Request, res: Response, error: unknown): void => {
  logger.error({ category: 'error', ...requestContext(req), err: error }, 'unhandled request error')

  if (res.headersSent) {
    return
  }

  res.status(500).json({ success: false, message: GENERIC_ERROR, requestId: req.requestId })
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Body-parser errors (malformed JSON, body too large) are client errors, not server faults
  const status = (error as { status?: number; type?: string })?.status
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ success: false, message: 'คำขอไม่ถูกต้อง', requestId: req.requestId })
    return
  }

  respondServerError(req, res, error)
}

// Last-resort handlers for the whole process (ASVS V16.5.4). An unhandled promise rejection is
// logged and the process keeps serving; an uncaught exception leaves the process in an unknown
// state, so it is logged and the process exits for Docker (`restart: unless-stopped`) to restart.
export const installProcessErrorHandlers = (service: string): void => {
  process.on('unhandledRejection', (reason) => {
    logger.error({ category: 'error', service, err: reason }, 'unhandled promise rejection')
  })

  process.on('uncaughtException', (error) => {
    logger.fatal({ category: 'error', service, err: error }, 'uncaught exception, exiting')
    process.exit(1)
  })
}
