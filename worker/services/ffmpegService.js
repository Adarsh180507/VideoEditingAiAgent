import ffmpeg from 'fluent-ffmpeg';

/**
 * Service to handle media manipulation using FFmpeg binaries.
 */
export const ffmpegService = {
    /**
     * Extracts a highly optimized audio track from a local video file.
     * @param {string} inputPath - Absolute path to the local raw video.
     * @param {string} outputPath - Destination path for the extracted MP3.
     * @returns {Promise<string>} - Resolves with the output path on success.
     */
    extractAudio: (inputPath, outputPath) => {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-vn',                // Disable video recording (audio only)
                    '-acodec libmp3lame', // Use standard MP3 compression codec
                    '-ac 1',              // Downmix to 1 channel (mono) to save 50% space
                    '-ar 16000',          // Sample rate 16kHz (perfect for AI speech analysis)
                    '-ab 64k'             // Bitrate 64kbps (highly legible voice data, tiny file size)
                ])
                .on('start', (commandLine) => {
                    console.log(`[FFmpeg] Spawned process with command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`[FFmpeg] Audio Extraction Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    console.log(`[FFmpeg] Audio extraction completed successfully: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('[FFmpeg] Error during audio isolation processing:', err);
                    reject(err);
                })
                .save(outputPath);
        });
    }
};