import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const redis = new Redis(redisUrl);

redis.on('error', (err) => {
  // Keep errors quiet in production logs; controllers should handle cache misses gracefully
  console.warn('Redis error', err.message || err);
});

export default redis;
