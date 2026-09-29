import { Router } from 'express'
import User from '../models/User.js'
import Registration from '../models/Registration.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.get('/me', requireAuth, (req, res) => res.json(req.user))
router.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try { res.json(await User.find().select('name email role createdAt').sort({ createdAt: -1 })) } catch (error) { next(error) }
})
router.get('/me/registrations', requireAuth, async (req, res, next) => {
  try { res.json(await Registration.find({ email: req.user.email }).populate('event').sort({ createdAt: -1 })) } catch (error) { next(error) }
})

export default router
