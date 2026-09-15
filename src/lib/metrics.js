import { redis } from './redis.js';
import { redisEnabled } from './runtime.js';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const memoryCounters = new Map();

function pad(n, w = 2) { return String(n).padStart(w, '0'); }

export function fmtDaily(d = new Date(), useUTC = true) {
  const y = useUTC ? d.getUTCFullYear() : d.getFullYear();
  const m = (useUTC ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = useUTC ? d.getUTCDate() : d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

export function fmtMonthly(d = new Date(), useUTC = true) {
  const y = useUTC ? d.getUTCFullYear() : d.getFullYear();
  const m = (useUTC ? d.getUTCMonth() : d.getMonth()) + 1;
  return `${y}-${pad(m)}`;
}

export function fmtWeekly(d = new Date()) {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 3 - ((tmp.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  const year = tmp.getUTCFullYear();
  return `${year}-W${pad(weekNo)}`;
}

export function fmtYearly(d = new Date(), useUTC = true) {
  return String(useUTC ? d.getUTCFullYear() : d.getFullYear());
}

export function addDays(d, n) { const dt = new Date(d); dt.setUTCDate(dt.getUTCDate() + n); return dt; }
export function addWeeks(d, n) { return addDays(d, n * 7); }
export function addMonths(d, n) { const dt = new Date(d); dt.setUTCMonth(dt.getUTCMonth() + n); return dt; }
export function addYears(d, n) { const dt = new Date(d); dt.setUTCFullYear(dt.getUTCFullYear() + n); return dt; }

function memoryIncr(key, ttlSeconds) {
  const next = Number(memoryCounters.get(key) || 0) + 1;
  memoryCounters.set(key, next);
  if (ttlSeconds > 0) {
    setTimeout(() => {
      if (memoryCounters.get(key) === next) memoryCounters.delete(key);
    }, ttlSeconds * 1000).unref?.();
  }
  return next;
}

export async function incrementMetricAllPeriods(baseKey, now = new Date(), ttlSeconds = ONE_YEAR_SECONDS) {
  const dailyKey = `${baseKey}:daily:${fmtDaily(now)}`;
  const weeklyKey = `${baseKey}:weekly:${fmtWeekly(now)}`;
  const monthlyKey = `${baseKey}:monthly:${fmtMonthly(now)}`;
  const yearlyKey = `${baseKey}:yearly:${fmtYearly(now)}`;
  const keys = [dailyKey, weeklyKey, monthlyKey, yearlyKey];

  if (!redisEnabled) {
    for (const k of keys) memoryIncr(k, ttlSeconds);
    return;
  }

  const pipe = redis.multi();
  for (const k of keys) pipe.incr(k).ttl(k);
  const results = await pipe.exec();
  const pipe2 = redis.multi();
  keys.forEach((k, i) => {
    const ttl = Array.isArray(results?.[i * 2 + 1]) ? results[i * 2 + 1][1] : -1;
    if (typeof ttl === 'number' && ttl < 0) pipe2.expire(k, ttlSeconds);
  });
  try { await pipe2.exec(); } catch { /* ignore */ }
}

export function buildLabels(period, count, endDate = new Date()) {
  const labels = [];
  const d = new Date(endDate);
  for (let i = count - 1; i >= 0; i--) {
    let dt;
    if (period === 'daily') dt = addDays(d, -(count - 1 - i));
    else if (period === 'weekly') dt = addWeeks(d, -(count - 1 - i));
    else if (period === 'monthly') dt = addMonths(d, -(count - 1 - i));
    else if (period === 'yearly') dt = addYears(d, -(count - 1 - i));
    else dt = d;
    if (period === 'daily') labels.push(fmtDaily(dt));
    else if (period === 'weekly') labels.push(fmtWeekly(dt));
    else if (period === 'monthly') labels.push(fmtMonthly(dt));
    else if (period === 'yearly') labels.push(fmtYearly(dt));
  }
  return labels;
}

export async function getRedisSeries(baseKey, period, count, endDate = new Date()) {
  const labels = buildLabels(period, count, endDate);
  const keys = labels.map((l) => `${baseKey}:${period}:${l}`);
  if (!redisEnabled) {
    return labels.map((bucket, idx) => ({ bucket, value: Number(memoryCounters.get(keys[idx]) || 0) }));
  }
  const raw = await redis.mget(keys);
  const values = (raw || []).map((v) => Number(v || 0));
  return labels.map((bucket, idx) => ({ bucket, value: values[idx] }));
}
