import Redis from 'ioredis';
import { redisEnabled } from './runtime.js';

const memoryStore = new Map();

function memoryGet(key) {
  const hit = memoryStore.get(key);
  if (!hit) return null;
  if (hit.exp && Date.now() > hit.exp) {
    memoryStore.delete(key);
    return null;
  }
  return hit.value;
}

function memorySet(key, value, ttlSeconds) {
  const exp = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
  memoryStore.set(key, { value: String(value), exp });
}

function createMemoryRedis() {
  return {
    status: 'ready',
    async get(key) {
      return memoryGet(key);
    },
    async set(key, value, exFlag, ttl) {
      const seconds = exFlag === 'EX' ? Number(ttl) || 0 : 0;
      memorySet(key, value, seconds);
      return 'OK';
    },
    async del(key) {
      return memoryStore.delete(key) ? 1 : 0;
    },
    async incr(key) {
      const next = Number(memoryGet(key) || 0) + 1;
      const prev = memoryStore.get(key);
      const ttlSeconds = prev?.exp ? Math.max(1, Math.ceil((prev.exp - Date.now()) / 1000)) : 0;
      memorySet(key, next, ttlSeconds);
      return next;
    },
    async mget(keys) {
      return (keys || []).map((key) => memoryGet(key));
    },
    async ttl(key) {
      const hit = memoryStore.get(key);
      if (!hit) return -2;
      if (!hit.exp) return -1;
      return Math.max(0, Math.ceil((hit.exp - Date.now()) / 1000));
    },
    async expire(key, seconds) {
      const hit = memoryStore.get(key);
      if (!hit) return 0;
      memorySet(key, hit.value, Number(seconds) || 0);
      return 1;
    },
    multi() {
      const ops = [];
      const pipeline = {
        incr(key) {
          ops.push(['incr', key]);
          return pipeline;
        },
        ttl(key) {
          ops.push(['ttl', key]);
          return pipeline;
        },
        expire(key, seconds) {
          ops.push(['expire', key, seconds]);
          return pipeline;
        },
        async exec() {
          const results = [];
          for (const [cmd, key, extra] of ops) {
            if (cmd === 'incr') results.push([null, await thisRedis.incr(key)]);
            else if (cmd === 'ttl') results.push([null, await thisRedis.ttl(key)]);
            else if (cmd === 'expire') results.push([null, await thisRedis.expire(key, extra)]);
          }
          return results;
        },
      };
      const thisRedis = createMemoryRedis();
      return pipeline;
    },
    on() {},
  };
}

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisPassword = process.env.REDIS_PASSWORD;

let redis;

if (!redisEnabled) {
  redis = createMemoryRedis();
} else if (redisPassword) {
  const url = new URL(redisUrl);
  redis = new Redis({
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: redisPassword,
  });
} else {
  redis = new Redis(redisUrl);
}

if (redisEnabled) {
  redis.on('error', (err) => {
    console.warn('Redis error', err && err.message ? err.message : err);
  });
}

export async function closeRedis() {
  if (redisEnabled && redis.status !== 'end') await redis.quit();
}

export { redis };
export default redis;
