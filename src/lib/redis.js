import Redis from 'ioredis';

// Support both REDIS_URL and explicit REDIS_PASSWORD. When a password is provided
// prefer passing options to ioredis so credentials aren't duplicated in a URL.
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let redis;
if (redisPassword) {
  const url = new URL(redisUrl);
  redis = new Redis({
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: redisPassword,
    // keep default ready-check behaviour; adjust if using sentinel/cluster
  });
} else {
  redis = new Redis(redisUrl);
}

redis.on('error', (err) => {
  // Keep errors quiet in production logs; controllers should handle cache misses gracefully
  console.warn('Redis error', err && err.message ? err.message : err);
});

export { redis };
export default redis;
