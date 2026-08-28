import express from 'express'
import cors from 'cors'
import r from './r.route.js'
import { errorHandler, notFoundHandler } from '../../middleware/error.middleware.js'

const app = express()

app.disable('x-powered-by')

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1', r)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
