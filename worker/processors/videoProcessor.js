import path from 'path';
import fs from 'fs';
import https from 'https';
import { ffmpegService } from '../services/ffmpegService.js';
import { aiAnalysisService } from '../services/aiAnalysisService.js';
import { videoEditService } from '../services/videoEditService.js'; // <-- NEW IMPORT

const downloadFile = (url, destPath) => { /* ... download file logic ... */ 
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) { reject(new Error(`Status Code: ${response.statusCode}`)); return; }
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(destPath); });
        }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
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
        // Stage 1: Download Source from Cloudinary
        await job.updateProgress(10);
        console.log(`[Job ${jobId}] Stage 1/4: Downloading video from cloud tier...`);
        await downloadFile(videoUrl, localVideoPath);

        // Stage 2: Extract Optimized Voice Audio
        await job.updateProgress(35);
        console.log(`[Job ${jobId}] Stage 2/4: Isolating audio tracks with FFmpeg...`);
        await ffmpegService.extractAudio(localVideoPath, extAudioPath);

        // Stage 3: Send Audio Track to Gemini for Timestamp Generation
        await job.updateProgress(60);
        console.log(`[Job ${jobId}] Stage 3/4: Transmitting audio context to AI Agent...`);
        const highlightTimestamps = await aiAnalysisService.analyze(extAudioPath, prompt);
        console.log(`[Job ${jobId}] AI identified ${highlightTimestamps.length} highlights.`);

        // Stage 4: Render Spliced Edits & Upload Back to Cloud Storage
        await job.updateProgress(85);
        console.log(`[Job ${jobId}] Stage 4/4: Rendering highlight clips & syncing...`);
        
        // --- NEW EDITING STEP EXECUTION ---
        const finalEditedAsset = await videoEditService.compileHighlights(
            localVideoPath, 
            highlightTimestamps, 
            tempDir
        );
        // ----------------------------------

        await job.updateProgress(100);
        
        // This object is returned to BullMQ as 'returnvalue' 
        // Our Express API status endpoint fetches this directly via job.returnvalue
        return { 
            success: true, 
            message: "Pipeline completed cleanly.", 
            editedVideoUrl: finalEditedAsset.secure_url,
            publicId: finalEditedAsset.public_id
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