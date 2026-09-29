import mongoose from 'mongoose'

const registrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  status: { type: String, enum: ['confirmed', 'cancelled', 'attended', 'waitlisted'], default: 'confirmed' },
}, { timestamps: true })

registrationSchema.index({ event: 1, email: 1 }, { unique: true })
export default mongoose.model('Registration', registrationSchema)
