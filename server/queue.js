import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Connect to Redis (Make sure Redis is running on your machine)
const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});

// Create the Queue
export const videoQueue = new Queue('videoProcessing', {
    connection: redisConnection
});

console.log('BullMQ Queue initialized: videoProcessing');