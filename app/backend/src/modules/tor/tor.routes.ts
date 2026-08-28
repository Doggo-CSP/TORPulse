import { Router } from 'express'

const r = Router()

r.get('/check', (_req, res, next) => {
  res.json({ message: 'heelo' })
  return
})
export default r
