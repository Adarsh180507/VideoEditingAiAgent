import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
ffmpeg.setFfmpegPath(ffmpegStatic);
export const ffmpegService = {
  extractAudio: (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-vn",
          "-acodec libmp3lame",
          "-ac 1",
          "-ar 16000",
          "-ab 64k",
        ])
        .on("start", (commandLine) => {
          console.log(`[FFmpeg] Spawned process with command: ${commandLine}`);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(
              `[FFmpeg] Audio Extraction Progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on("end", () => {
          console.log(
            `[FFmpeg] Audio extraction completed successfully: ${outputPath}`,
          );
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(
            "[FFmpeg] Error during audio isolation processing:",
            err,
          );
          reject(err);
        })
        .save(outputPath);
    });
  },
};
