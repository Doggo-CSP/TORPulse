import { Router } from 'express'
import router_tor from '../../modules/tor/tor.routes.js'
const r = Router()

r.use('/tor', router_tor)
export default r
