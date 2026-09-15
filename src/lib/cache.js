import { redis } from './redis.js';
import { redisEnabled } from './runtime.js';

const memoryCache = new Map();

function memoryGet(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (hit.exp && Date.now() > hit.exp) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

export async function getJson(key) {
  try {
    if (!redisEnabled) return memoryGet(key);
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setJson(key, value, ttlSeconds = 60) {
  try {
    if (!redisEnabled) {
      const exp = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
      memoryCache.set(key, { value, exp });
      return;
    }
    const str = JSON.stringify(value);
    if (ttlSeconds > 0) await redis.set(key, str, 'EX', ttlSeconds);
    else await redis.set(key, str);
  } catch {
    // swallow cache errors
  }
}

export async function del(key) {
  try {
    if (!redisEnabled) {
      memoryCache.delete(key);
      return;
    }
    await redis.del(key);
  } catch {
    // swallow cache errors
  }
}
