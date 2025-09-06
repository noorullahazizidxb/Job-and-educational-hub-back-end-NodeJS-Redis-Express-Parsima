import { redis } from './redis.js';

export async function getJson(key) {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    // If Redis is down or parse fails, treat as cache miss
    return null;
  }
}

export async function setJson(key, value, ttlSeconds = 60) {
  try {
    const str = JSON.stringify(value);
    if (ttlSeconds > 0) await redis.set(key, str, 'EX', ttlSeconds);
    else await redis.set(key, str);
  } catch (e) {
    // swallow cache errors
  }
}

export async function del(key) {
  try { await redis.del(key); } catch (e) {}
}
