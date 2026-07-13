import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    credits: {
      type: Number,
      default: 10,
    },

    videoHistory: [
      {
        videoUrl: String,
        publicId: String,
        prompt: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
