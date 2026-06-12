import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import cloudinary from '../config/cloudinary.js';

export const videoEditService = {
    /**
     * Slices an input video into clips based on timestamps, merges them, 
     * and uploads the final edit back to Cloudinary.
     * * @param {string} inputVideoPath - Path to local high-res source video.
     * @param {Array} timestamps - Array of objects containing {start, end}.
     * @param {string} tempDir - The unique job workspace directory.
     * @returns {Promise<Object>} - Resolves with the Cloudinary upload data.
     */
    compileHighlights: async (inputVideoPath, timestamps, tempDir) => {
        return new Promise((resolve, reject) => {
            if (!timestamps || timestamps.length === 0) {
                return reject(new Error("No highlight timestamps provided for compilation."));
            }

            const clipPaths = [];
            let clipsProcessed = 0;

            // 1. Extract each individual highlight segment from the source video
            timestamps.forEach((segment, index) => {
                const clipPath = path.join(tempDir, `clip_${index}.mp4`);
                clipPaths.push(clipPath);

                const duration = segment.end - segment.start;

                ffmpeg(inputVideoPath)
                    .setStartTime(segment.start)
                    .setDuration(duration)
                    .outputOptions([
                        '-c copy', // Stream copy mode: lightning-fast cuts without CPU re-encoding
                        '-avoid_negative_ts make_zero' // Ensures audio sync stays perfect post-cut
                    ])
                    .on('end', () => {
                        clipsProcessed++;
                        console.log(`[FFmpeg] Successfully cut clip ${clipsProcessed}/${timestamps.length}`);

                        // Once all clips are cut locally, proceed to merge them together
                        if (clipsProcessed === timestamps.length) {
                            mergeClips(clipPaths, tempDir, resolve, reject);
                        }
                    })
                    .on('error', (err) => {
                        console.error(`[FFmpeg] Error cutting segment index ${index}:`, err);
                        reject(err);
                    })
                    .save(clipPath);
            });
        });
    }
};

/**
 * Merges multiple cut clips into a single finalized output video.
 */
const mergeClips = (clipPaths, tempDir, resolve, reject) => {
    const finalOutputPath = path.join(tempDir, 'final_highlight_reel.mp4');
    const txtFilePath = path.join(tempDir, 'ffmpeg_concat_list.txt');

    // Generate standard FFmpeg concat file list containing filenames to combine
    const fileContent = clipPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
    fs.writeFileSync(txtFilePath, fileContent);

    console.log('[FFmpeg] Initiating concatenation sequence...');

    ffmpeg()
        .input(txtFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy']) // Fast join via stream copy container stitching
        .on('end', async () => {
            console.log(`[FFmpeg] Highlight reel finalized locally: ${finalOutputPath}`);
            
            try {
                // 2. Upload the edited masterpiece back to the Cloudinary storage tier
                console.log('[Cloudinary] Syncing edited highlight reel to cloud storage...');
                const result = await cloudinary.uploader.upload(finalOutputPath, {
                    resource_type: 'video',
                    folder: 'ai_agent_edited_videos'
                });

                resolve(result);
            } catch (uploadError) {
                reject(uploadError);
            }
        })
        .on('error', (err) => {
            console.error('[FFmpeg] Splicing failed during concatenation:', err);
            reject(err);
        })
        .save(finalOutputPath);
};