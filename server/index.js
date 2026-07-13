import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import { videoQueue } from "./queue.js";
import { User } from "./models/User.js";
import authRoutes from "./routes/authRoutes.js";
import { protectAndCheckCredits } from "./middleware/authMiddleware.js";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "Server running cleanly" });
});
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
app.get("/api/user/history", requireAuth, async (req, res) => {
  try {
    const history = req.user.videoHistory.sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});
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
app.get("/api/upload/signature", protectAndCheckCredits, (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign = {
    timestamp: timestamp,
    folder: "ai_agent_videos",
  };
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
    const job = await videoQueue.add("extract-highlights", {
      videoUrl,
      publicId,
      originalName: originalName || "untitled_video.mp4",
      prompt: prompt || "Find the best highlights",
    });
    req.user.credits -= 1;
    await req.user.save();

    console.log(
      `[Paywall] Job ${job.id} queued. Credits remaining: ${req.user.credits}`,
    );

    res.status(202).json({
      message: "Video processing job successfully initialized and queued.",
      jobId: job.id,
      videoUrl,
      creditsRemaining: req.user.credits,
    });
  } catch (error) {
    console.error("Queue error:", error);
    res
      .status(500)
      .json({ error: "Failed to delegate processing job to queue manager." });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    const job = await videoQueue.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found in queue." });
    }
    const state = await job.getState();

    res.status(200).json({
      id: job.id,
      state: state,
      progress: job.progress,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
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
