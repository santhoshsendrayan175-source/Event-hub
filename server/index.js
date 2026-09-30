import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import path from 'node:path'
import Event from './models/Event.js'
import { seedEvents } from './seedEvents.js'
import eventRoutes from './routes/events.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'

const app = express()
const port = process.env.PORT || 5000

async function backfillEventCoordinates() {
  const missingCoordinates = await Event.find({ 'coordinates.coordinates': { $exists: false } }).select('_id venue location')
  let updatedCount = 0
  for (const event of missingCoordinates) {
    try {
      const address = `${event.venue}, ${event.location}`
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) continue
      const result = await response.json()
      const [longitude, latitude] = result.features?.[0]?.geometry?.coordinates || []
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
      await Event.updateOne({ _id: event._id }, { $set: { coordinates: { type: 'Point', coordinates: [longitude, latitude] } } })
      updatedCount += 1
    } catch (error) {
      console.warn(`Could not geocode existing event ${event._id}: ${error.message}`)
    }
  }
  if (updatedCount) console.log(`Added coordinates to ${updatedCount} existing event(s)`)
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }))
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next()
  if (req.method === 'GET' && (req.path === '/events' || req.path === '/events/nearby')) return res.json([])
  res.status(503).json({ message: 'MongoDB is not connected. Configure MONGODB_URI to enable persistence.' })
})
app.use('/api/events', eventRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use(express.static(path.resolve('dist')))
app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(error.status || 500).json({ message: error.message || 'Something went wrong.' })
})

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      await Event.createIndexes()
      if (await Event.countDocuments() === 0) {
        await Event.insertMany(seedEvents)
        console.log('Added sample events to the empty database')
      } else {
        await Promise.all(seedEvents.map(({ title, coordinates }) => Event.updateOne(
          { title, coordinates: { $exists: false } },
          { $set: { coordinates } },
        )))
      }
      await backfillEventCoordinates()
      console.log('MongoDB connected')
    })
    .catch((error) => console.error('MongoDB connection failed:', error.message))
} else {
  console.warn('MONGODB_URI is not set. API starts, but database operations are unavailable.')
}

app.listen(port, () => console.log(`EventHub API listening on http://localhost:${port}`))
