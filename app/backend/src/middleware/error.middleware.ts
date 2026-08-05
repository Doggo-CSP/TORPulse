import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    message: `Not Found ${req.originalUrl}`,
  })
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error(error)

  const message = error instanceof Error ? error.message : 'Internal server error'

  res.status(500).json({
    message,
  })
}
