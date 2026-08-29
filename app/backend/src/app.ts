import express from 'express'
import cors from 'cors'
import session from 'express-session'
import r from './r.route.js'
import authRouter from './routes/auth.js'
import passport from './config/passport.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'

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

app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
)
app.use(passport.initialize())
app.use(passport.session())

app.get('/', (_req, res) => {
  res.send('<a href="/auth/google">Login with Google</a>')
})

app.use('/auth', authRouter)
app.use('/api/v1', r)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
