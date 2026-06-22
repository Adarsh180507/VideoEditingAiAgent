import path from "path";
import fs from "fs";
import https from "https";
import { ffmpegService } from "../services/ffmpegService.js";
import { intentService } from "../services/intentService.js";
import { aiAnalysisService } from "../services/aiAnalysisService.js";
import { videoEditService } from "../services/videoEditService.js";

const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Status Code: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(destPath);
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
};

export const videoProcessor = async (job) => {
  const { videoUrl, originalName, prompt } = job.data;
  const jobId = job.id;

  const tempDir = path.join(process.cwd(), "temp", jobId);
  fs.mkdirSync(tempDir, { recursive: true });

  const localVideoPath = path.join(tempDir, `input_${originalName}`);
  const extAudioPath = path.join(tempDir, "extracted_audio.mp3");

  let finalHighlights = [];
  let finalInsights = "";

  try {
    // Stage 0: The Fast-Lane Router
    await job.updateProgress(5);
    console.log(
      `[Job ${jobId}] Stage 0: Analyzing intent for fast-lane routing...`,
    );
    const routerDecision = await intentService.analyzeIntent(prompt);

    // Stage 1: Download Source from Cloudinary (Always needed for rendering)
    await job.updateProgress(10);
    console.log(
      `[Job ${jobId}] Stage 1/4: Downloading video from cloud tier...`,
    );
    await downloadFile(videoUrl, localVideoPath);

    // Branch the architecture based on Intent
    if (
      routerDecision.intent === "structural_edit" &&
      routerDecision.highlights?.length > 0
    ) {
      // ⚡ FAST LANE ⚡
      console.log(
        `[Job ${jobId}] ⚡ FAST LANE ACTIVATED: Skipping audio extraction and deep analysis.`,
      );

      finalHighlights = routerDecision.highlights;
      finalInsights =
        routerDecision.insights ||
        "I caught your exact timestamps. Fast-tracking your edit right to the rendering phase!";

      await job.updateProgress(60); // Jump progress visually
    } else {
      // 🧠 SEMANTIC SEARCH 🧠
      console.log(
        `[Job ${jobId}] 🧠 SEMANTIC SEARCH ACTIVATED: Booting up audio pipeline.`,
      );

      // Stage 2: Extract Optimized Voice Audio
      await job.updateProgress(35);
      console.log(
        `[Job ${jobId}] Stage 2/4: Isolating audio tracks with FFmpeg...`,
      );
      await ffmpegService.extractAudio(localVideoPath, extAudioPath);

      // Stage 3: Send Audio Track to Gemini
      await job.updateProgress(60);
      console.log(
        `[Job ${jobId}] Stage 3/4: Transmitting audio context to AI Agent...`,
      );

      const aiResult = await aiAnalysisService.analyze(extAudioPath, prompt);

      // Handle the object structure returning from the upgraded aiAnalysisService
      finalHighlights = aiResult.highlights || [];
      finalInsights = aiResult.insights || "Analysis and rendering complete!";
    }

    console.log(
      `[Job ${jobId}] Ready to render with ${finalHighlights.length} highlights.`,
    );

    // Stage 4: Render Spliced Edits & Upload Back to Cloud Storage
    await job.updateProgress(85);
    console.log(
      `[Job ${jobId}] Stage 4/4: Rendering highlight clips & syncing...`,
    );

    const finalEditedAsset = await videoEditService.compileHighlights(
      localVideoPath,
      finalHighlights,
      tempDir,
    );

    await job.updateProgress(100);

    // Return the consolidated data to the Express API / React Frontend
    return {
      success: true,
      message: "Pipeline completed cleanly.",
      editedVideoUrl: finalEditedAsset.secure_url,
      publicId: finalEditedAsset.public_id,
      insights: finalInsights,
    };
  } catch (error) {
    console.error(`[Job ${jobId}] Pipeline Execution Halted:`, error);
    throw error;
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`[Job ${jobId}] Workspace wiped: ${tempDir}`);
    }
  }
};
