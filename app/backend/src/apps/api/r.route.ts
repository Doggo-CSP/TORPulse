import { Router } from 'express'
import router_tor from '../../modules/tor/tor.routes.js'
import router_homepage from '../../modules/homepage/homepage.routes.js'
import router_user from '../../modules/user/user.routes.js'
import router_report from '../../modules/report/report.routes.js'
const r = Router()

r.use('/tors', router_tor)
r.use('/homepage', router_homepage)
r.use('/user', router_user)
r.use('/reports', router_report)
export default r
