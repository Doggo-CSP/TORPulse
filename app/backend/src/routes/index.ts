import { Request, Response, Router } from 'express'
import { mongodb } from '../config/mongodb.js'

const r = Router()

r.get('/health', async (req: Request, res: Response) => {
  await mongodb.getDb().command({ ping: 1 })
  res.status(200).json({
    message: 'OK',
    database: 'connected',
    timestamp: new Date().toISOString(),
  })
})

r.get('/test', async (_req: Request, res: Response) => {
  const test = await mongodb.getDb().collection('test').find({}).toArray()

  return res.status(200).json({
    data: test,
  })
})

export default r
