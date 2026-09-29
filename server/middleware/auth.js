import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' })
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-change-me')
    req.user = await User.findById(payload.sub).select('_id name email role')
    if (!req.user) return res.status(401).json({ message: 'Account not found.' })
    next()
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'You do not have permission to do that.' })
}
