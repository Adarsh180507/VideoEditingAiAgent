import { Worker } from "bullmq";
import { redisConnection } from "./config/redis.js";
import { videoProcessor } from "./processors/videoProcessor.js";
import dotenv from "dotenv";

dotenv.config();

console.log("Initializing Deep Video Processing Worker...");

const worker = new Worker("videoProcessing", videoProcessor, {
  connection: redisConnection,
  concurrency: 1,
  autorun: true,
});

worker.on("active", (job) => {
  console.log(
    `[Job ${job.id}] Started processing: ${job.data.originalName || "Video"}`,
  );
});

worker.on("completed", (job, result) => {
  console.log(`[Job ${job.id}] Successfully finalized processing workflow.`);
});

worker.on("failed", (job, err) => {
  console.error(`[Job ${job.id || "Unknown"}] CRITICAL FAILURE:`, err.message);
});
const shutdown = async (signal) => {
  console.log(
    `Received ${signal}. Gracefully shutting down video worker pipeline...`,
  );
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
