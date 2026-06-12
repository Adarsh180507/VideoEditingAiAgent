import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

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
app.use(express.json());

// Ensure temporary local uploads directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Configure temporary local disk storage for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5 GB limit
});

// Routes
app.post('/api/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }

    try {
        const localFilePath = req.file.path;

        // Upload large video file to Cloudinary using chunked stream upload
        // resource_type: 'video' is required for any media files that aren't raw images
        const cloudinaryResult = await cloudinary.uploader.upload_large(localFilePath, {
            resource_type: 'video',
            folder: 'ai_agent_videos',
            chunk_size: 6000000 // 6MB chunks
        });

        // After successful cloud upload, remove the local file to free up server disk space
        fs.unlinkSync(localFilePath);

        // Next step: push cloudinaryResult.secure_url and public_id to the Redis queue
        res.status(202).json({
            message: 'Video uploaded to Cloudinary successfully. Processing started.',
            videoUrl: cloudinaryResult.secure_url,
            publicId: cloudinaryResult.public_id
        });

    } catch (error) {
        console.error('Cloudinary upload error:', error);
        
        // Cleanup local file if Cloudinary upload fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to upload video to cloud storage' });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server running cleanly' });
});

app.listen(PORT, () => {
    console.log(`Server listening intently on port ${PORT}`);
});