import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import cloudinary from "../config/cloudinary.js";

export const videoEditService = {
  compileHighlights: async (inputVideoPath, timestamps, tempDir) => {
    return new Promise((resolve, reject) => {
      if (!timestamps || timestamps.length === 0) {
        return reject(
          new Error("No highlight timestamps provided for compilation."),
        );
      }

      const clipPaths = [];
      let clipsProcessed = 0;

      timestamps.forEach((segment, index) => {
        const clipPath = path.join(tempDir, `clip_${index}.mp4`);
        clipPaths.push(clipPath);

        const duration = segment.end - segment.start;

        ffmpeg(inputVideoPath)
          .setStartTime(segment.start)
          .setDuration(duration)
          .outputOptions(["-c copy", "-avoid_negative_ts make_zero"])
          .on("end", () => {
            clipsProcessed++;
            console.log(
              `[FFmpeg] Successfully cut clip ${clipsProcessed}/${timestamps.length}`,
            );

            if (clipsProcessed === timestamps.length) {
              mergeClips(clipPaths, tempDir, resolve, reject);
            }
          })
          .on("error", (err) => {
            console.error(
              `[FFmpeg] Error cutting segment index ${index}:`,
              err,
            );
            reject(err);
          })
          .save(clipPath);
      });
    });
  },
};

const mergeClips = (clipPaths, tempDir, resolve, reject) => {
  const finalOutputPath = path.join(tempDir, "final_highlight_reel.mp4");
  const txtFilePath = path.join(tempDir, "ffmpeg_concat_list.txt");

  const fileContent = clipPaths
    .map((p) => `file '${path.resolve(p)}'`)
    .join("\n");
  fs.writeFileSync(txtFilePath, fileContent);

  console.log("[FFmpeg] Initiating concatenation sequence...");

  ffmpeg()
    .input(txtFilePath)
    .inputOptions(["-f concat", "-safe 0"])
    .outputOptions(["-c copy"])
    .on("end", async () => {
      console.log(
        `[FFmpeg] Highlight reel finalized locally: ${finalOutputPath}`,
      );

      try {
        console.log(
          "[Cloudinary] Syncing edited highlight reel to cloud storage...",
        );
        const result = await cloudinary.uploader.upload(finalOutputPath, {
          resource_type: "video",
          folder: "ai_agent_edited_videos",
        });

        resolve(result);
      } catch (uploadError) {
        reject(uploadError);
      }
    })
    .on("error", (err) => {
      console.error("[FFmpeg] Splicing failed during concatenation:", err);
      reject(err);
    })
    .save(finalOutputPath);
};
