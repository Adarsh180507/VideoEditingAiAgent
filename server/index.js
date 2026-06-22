import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import { videoQueue } from "./queue.js";
import { User } from "./models/User.js";

// Import your Auth routes and Middleware
import authRoutes from "./routes/authRoutes.js";
import { protectAndCheckCredits } from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(cors());
app.use(express.json()); // Light payloads only

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Mount the Auth Routes (Register / Login)
app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "Server running cleanly" });
});

// ==========================================
// USER DASHBOARD (NO CREDIT CHECK REQUIRED)
// ==========================================

// Basic auth checker that allows users with 0 credits to view their history
const requireAuth = async (req, res, next) => {
  try {
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer")
    ) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
};

// GET: Fetch the user's video history
app.get("/api/user/history", requireAuth, async (req, res) => {
  try {
    // Return history sorted by newest first
    const history = req.user.videoHistory.sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// POST: Save a newly generated video to the user's database document
app.post("/api/user/history", requireAuth, async (req, res) => {
  try {
    const { videoUrl, publicId, prompt } = req.body;
    req.user.videoHistory.push({ videoUrl, publicId, prompt });
    await req.user.save();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save history" });
  }
});

// ==========================================
// PROTECTED SAAS ROUTES (CREDIT PAYWALL)
// ==========================================

/**
 * STEP 1: Generate a secure signature for direct client-side upload.
 * PROTECTED: Prevents random unauthenticated bots from uploading to your Cloudinary.
 */
app.get("/api/upload/signature", protectAndCheckCredits, (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);

  // Define parameters that the client MUST adhere to
  const paramsToSign = {
    timestamp: timestamp,
    folder: "ai_agent_videos",
  };

  // Generate cryptographic signature using API Secret
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET,
  );

  res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: "ai_agent_videos",
  });
});

/**
 * STEP 2: Endpoint called by the client AFTER successful upload to Cloudinary.
 * THE PAYWALL: Blocks users with 0 credits and deducts 1 credit upon success.
 */
app.post("/api/jobs/create", protectAndCheckCredits, async (req, res) => {
  const { videoUrl, publicId, originalName, prompt } = req.body;

  if (!videoUrl || !publicId) {
    return res
      .status(400)
      .json({ error: "Missing required Cloudinary asset metadata." });
  }

  try {
    console.log(
      `[Paywall] User ${req.user.email} initiating job. Credits before: ${req.user.credits}`,
    );

    // Enqueue the job for the background worker
    const job = await videoQueue.add("extract-highlights", {
      videoUrl,
      publicId,
      originalName: originalName || "untitled_video.mp4",
      prompt: prompt || "Find the best highlights",
    });

    // DEDUCT THE CREDIT
    req.user.credits -= 1;
    await req.user.save();

    console.log(
      `[Paywall] Job ${job.id} queued. Credits remaining: ${req.user.credits}`,
    );

    res.status(202).json({
      message: "Video processing job successfully initialized and queued.",
      jobId: job.id,
      videoUrl,
      creditsRemaining: req.user.credits, // Send back the updated balance to React
    });
  } catch (error) {
    console.error("Queue error:", error);
    res
      .status(500)
      .json({ error: "Failed to delegate processing job to queue manager." });
  }
});

/**
 * STEP 3: The Job Status Polling Endpoint.
 * (Left intentionally public. The specific Job ID acts as the secret, and we
 * do not want to block polling if a user's credit balance just hit 0).
 */
app.get("/api/jobs/:id", async (req, res) => {
  try {
    // Fetch the specific job from the Redis queue using the ID
    const job = await videoQueue.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found in queue." });
    }

    // getState() returns 'waiting', 'active', 'completed', or 'failed'
    const state = await job.getState();

    res.status(200).json({
      id: job.id,
      state: state,
      progress: job.progress, // The 10, 35, 60, 100 we set in the worker
      result: job.returnvalue || null, // Will contain the final video URL on success
      failedReason: job.failedReason || null, // Will contain error logs if it crashed
    });
  } catch (error) {
    console.error("Status fetch error:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve job status from queue." });
  }
});

app.listen(PORT, () => {
  console.log(`Production API Server listening on port ${PORT}`);
});
