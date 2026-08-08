const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('Redis Client Error', err));

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

const TASKS_CACHE_KEY = 'taskflow:tasks:all';

module.exports = { redisClient, connectRedis, TASKS_CACHE_KEY };
