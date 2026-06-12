import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null, // Critical requirement for BullMQ workers
});

redisConnection.on('connect', () => console.log('Worker smoothly connected to Redis'));
redisConnection.on('error', (err) => console.error('Worker Redis Connection Error:', err));