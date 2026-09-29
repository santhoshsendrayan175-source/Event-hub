import { Router } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const router = Router()
const issueToken = (user) => jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET || 'development-secret-change-me', { expiresIn: '7d' })

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body
    if (!name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || !password || password.length < 8) {
      return res.status(400).json({ message: 'Name, valid email, and password of at least 8 characters are required.' })
    }
    const user = await User.create({ name, email, password, role: role === 'organizer' ? 'organizer' : 'attendee' })
    res.status(201).json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' })
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+password')
    if (!user || !(await user.checkPassword(req.body.password || ''))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    res.json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

export default router
