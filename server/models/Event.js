import mongoose from 'mongoose'

const geoPointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true, validate: (value) => value.length === 2 },
}, { _id: false })

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, enum: ['Technology', 'Design', 'Music', 'Food & drink', 'Outdoors', 'Community'] },
  date: { type: String, required: true },
  time: { type: String, required: true },
  location: { type: String, required: true, trim: true },
  venue: { type: String, required: true, trim: true },
  description: { type: String, required: true, maxlength: 3000 },
  image: { type: String, default: '' },
  price: { type: Number, min: 0, default: 0 },
  capacity: { type: Number, min: 1, required: true },
  registeredCount: { type: Number, min: 0, default: 0 },
  organizer: { type: String, required: true, trim: true },
  format: { type: String, enum: ['In person', 'Online'], default: 'In person' },
  coordinates: { type: geoPointSchema, default: undefined },
  status: { type: String, enum: ['draft', 'published', 'cancelled', 'completed'], default: 'published' },
}, { timestamps: true })

eventSchema.index({ coordinates: '2dsphere' })

export default mongoose.model('Event', eventSchema)
