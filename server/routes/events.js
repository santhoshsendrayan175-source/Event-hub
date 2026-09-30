import { Router } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import Event from '../models/Event.js'
import Registration from '../models/Registration.js'

const router = Router()
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Choose a JPG, PNG, or WebP image.'))
    }
    callback(null, true)
  },
})

function parseImageUpload(req, res, next) {
  imageUpload.single('image')(req, res, (error) => {
    if (!error) return next()
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.message })
  })
}

router.get('/', async (req, res, next) => {
  try {
    const { category, search, dateFrom, dateTo, location, format, status = 'published' } = req.query
    const filter = { status }
    if (category && category !== 'Everything') filter.category = category
    if (dateFrom || dateTo) filter.date = { ...(dateFrom && { $gte: dateFrom }), ...(dateTo && { $lte: dateTo }) }
    if (format) filter.format = format
    if (location) filter.location = new RegExp(String(location), 'i')
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = ['title', 'description', 'location', 'organizer'].map((field) => ({ [field]: new RegExp(escaped, 'i') }))
    }
    res.json(await Event.find(filter).sort({ date: 1 }))
  } catch (error) { next(error) }
})

router.get('/nearby', async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat)
    const longitude = Number(req.query.lng)
    const radiusKm = Math.min(150, Math.max(1, Number(req.query.radiusKm) || 25))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({ message: 'A valid latitude and longitude are required.' })
    }
    const events = await Event.aggregate([
      { $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        distanceField: 'distanceMeters',
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: { status: 'published', date: { $gte: new Date().toISOString().slice(0, 10) } },
      } },
      { $sort: { distanceMeters: 1 } },
    ])
    res.json(events.map(({ distanceMeters, ...event }) => ({ ...event, distanceKm: Math.round(distanceMeters / 100) / 10 })))
  } catch (error) { next(error) }
})

router.post('/image', parseImageUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload.' })
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Image uploads are not configured on this server.' })
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    const uploadedImage = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: 'eventhub/events',
        resource_type: 'image',
        transformation: [{ width: 1600, height: 1000, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
      }, (error, result) => error ? reject(error) : resolve(result))
      stream.end(req.file.buffer)
    })
    if (!uploadedImage?.secure_url) return res.status(502).json({ message: 'The image could not be stored.' })
    res.status(201).json({ url: uploadedImage.secure_url })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
    if (!event) return res.status(404).json({ message: 'Event not found.' })
    res.json(event)
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    const event = await Event.create(req.body)
    res.status(201).json(event)
  } catch (error) { next(error) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!event) return res.status(404).json({ message: 'Event not found.' })
    res.json(event)
  } catch (error) { next(error) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id)
    if (!event) return res.status(404).json({ message: 'Event not found.' })
    await Registration.deleteMany({ event: event._id })
    res.status(204).end()
  } catch (error) { next(error) }
})

router.get('/:id/registrations', async (req, res, next) => {
  try { res.json(await Registration.find({ event: req.params.id }).sort({ createdAt: -1 })) } catch (error) { next(error) }
})

router.post('/:id/register', async (req, res, next) => {
  try {
    const { name, email, phone } = req.body
    if (!name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ message: 'A name and valid email are required.' })
    if (!phone?.trim() || !/^[+\d().\s-]{7,30}$/.test(phone.trim())) return res.status(400).json({ message: 'A valid phone number is required.' })
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, status: 'published', $expr: { $lt: ['$registeredCount', '$capacity'] } },
      { $inc: { registeredCount: 1 } },
      { new: true },
    )
    if (!event) return res.status(409).json({ message: 'This event is full or no longer available.' })
    try {
      const registration = await Registration.create({ event: event._id, name, email, phone: phone.trim() })
      res.status(201).json({ registration, event })
    } catch (error) {
      await Event.updateOne({ _id: event._id }, { $inc: { registeredCount: -1 } })
      if (error.code === 11000) return res.status(409).json({ message: 'This email is already registered for the event.' })
      throw error
    }
  } catch (error) { next(error) }
})

export default router
