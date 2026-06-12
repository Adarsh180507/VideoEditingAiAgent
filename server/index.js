import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { videoQueue } from './queue.js'; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors());
app.use(express.json()); // Light payloads only

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

/**
 * STEP 1: Generate a secure signature for direct client-side upload.
 * This keeps our backend totally free from handling heavy video bytes.
 */
app.get('/api/upload/signature', (req, res) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Define parameters that the client MUST adhere to
    const paramsToSign = {
        timestamp: timestamp,
        folder: 'ai_agent_videos',
        resource_type: 'video'
    };

    // Generate cryptographic signature using API Secret
    const signature = cloudinary.utils.api_sign_request(
        paramsToSign, 
        process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder: 'ai_agent_videos'
    });
});

/**
 * STEP 2: Endpoint called by the client AFTER successful upload to Cloudinary.
 * Receives the cloud asset metadata and drops it cleanly into the queue.
 */
app.post('/api/jobs/create', async (req, res) => {
    const { videoUrl, publicId, originalName, prompt } = req.body;

    if (!videoUrl || !publicId) {
        return res.status(400).json({ error: 'Missing required Cloudinary asset metadata.' });
    }

    try {
        // Enqueue the job for the background worker
        const job = await videoQueue.add('extract-highlights', {
            videoUrl,
            publicId,
            originalName: originalName || 'untitled_video.mp4',
            prompt: prompt || "Find the best highlights"
        });

        res.status(202).json({
            message: 'Video processing job successfully initialized and queued.',
            jobId: job.id,
            videoUrl
        });

    } catch (error) {
        console.error('Queue error:', error);
        res.status(500).json({ error: 'Failed to delegate processing job to queue manager.' });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server running cleanly' });
});
/**
 * STEP 3: The Job Status Polling Endpoint.
 * The React frontend will call this repeatedly (e.g., every 3 seconds) 
 * to update the user's progress bar and get the final video URL.
 */
app.get('/api/jobs/:id', async (req, res) => {
    try {
        // Fetch the specific job from the Redis queue using the ID
        const job = await videoQueue.getJob(req.params.id);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found in queue.' });
        }
        
        // getState() returns 'waiting', 'active', 'completed', or 'failed'
        const state = await job.getState(); 
        
        res.status(200).json({
            id: job.id,
            state: state,
            progress: job.progress, // The 10, 35, 60, 100 we set in the worker
            result: job.returnvalue || null, // Will contain the final video URL on success
            failedReason: job.failedReason || null // Will contain error logs if it crashed
        });

    } catch (error) {
        console.error('Status fetch error:', error);
        res.status(500).json({ error: 'Failed to retrieve job status from queue.' });
    }
});
app.listen(PORT, () => {
    console.log(`Production API Server listening on port ${PORT}`);
});