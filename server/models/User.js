import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true, // Hashed with bcryptjs
  },
  credits: {
    type: Number,
    default: 3, // Everyone starts with 3 free credits
  },
  // The Dashboard History!
  videoHistory: [{
    videoUrl: String,
    publicId: String,
    prompt: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);