import path from 'path';
import fs from 'fs';
import https from 'https'; // Native https module for downloading the file securely
import { ffmpegService } from '../services/ffmpegService.js';

// Helper to handle production file streaming download from Cloudinary
const downloadFile = (url, destPath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download asset. Status Code: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {}); 
            reject(err);
        });
    });
};

export const videoProcessor = async (job) => {
    const { videoUrl, originalName, prompt } = job.data;
    const jobId = job.id;
    
    const tempDir = path.join(process.cwd(), 'temp', jobId);
    fs.mkdirSync(tempDir, { recursive: true });

    const localVideoPath = path.join(tempDir, `input_${originalName}`);
    const extAudioPath = path.join(tempDir, 'extracted_audio.mp3');

    try {
        // Stage 1: Download from Cloudinary storage
        await job.updateProgress(10);
        console.log(`[Job ${jobId}] Stage 1/4: Downloading video from cloud tier...`);
        await downloadFile(videoUrl, localVideoPath);

        // Stage 2: Extract audio track with localized FFmpeg wrapper
        await job.updateProgress(35);
        console.log(`[Job ${jobId}] Stage 2/4: Isolating audio tracks with FFmpeg...`);
        await ffmpegService.extractAudio(localVideoPath, extAudioPath);

        // Stage 3: Send to AI Agent (Placeholder for next step)
        await job.updateProgress(60);
        console.log(`[Job ${jobId}] Stage 3/4: Transmitting audio context to AI Agent...`);
        // TODO: aiAnalysisService.analyze(extAudioPath, prompt)

        // Stage 4: Render edits (Placeholder)
        await job.updateProgress(85);
        console.log(`[Job ${jobId}] Stage 4/4: Rendering highlight clips & syncing...`);

        await job.updateProgress(100);
        return { success: true, message: "Pipeline extraction stage completed cleanly." };

    } catch (error) {
        console.error(`[Job ${jobId}] Pipeline Execution Halted:`, error);
        throw error; 
    } finally {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`[Job ${jobId}] Cleaned up local workspace: ${tempDir}`);
        }
    }
};