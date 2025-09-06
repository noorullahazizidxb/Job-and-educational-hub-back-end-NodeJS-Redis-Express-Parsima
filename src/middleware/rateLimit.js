import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Default global limiter: Allow 100 requests per IP/user per 60 seconds (tunable via env)
const points = Number(process.env.RATE_LIMIT_POINTS) || 100;
const duration = Number(process.env.RATE_LIMIT_DURATION) || 60;

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rlflx',
  points,
  duration,
});

// Dedicated, stricter limiter for login attempts (both IP and account)
const loginPoints = Number(process.env.LOGIN_RATE_LIMIT_POINTS) || 5;
const loginDuration = Number(process.env.LOGIN_RATE_LIMIT_DURATION) || 15 * 60; // 15 minutes
const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rlflx_login',
  points: loginPoints,
  duration: loginDuration,
});

function getIp(req) {
  // prefer x-forwarded-for when behind proxies/load balancers
  const xf = req.headers['x-forwarded-for'];
  if (xf && typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

export default async function rateLimitMiddleware(req, res, next) {
  try {
    // Exempt health check and static uploads from global limiting
    if (req.path === '/health' || req.path.startsWith('/uploads')) return next();

    // Use authenticated user id when available, otherwise fall back to IP
    const userId = req.user?.id ?? req.user?.sub ?? null;
    const key = userId ? `user:${String(userId)}` : `ip:${getIp(req)}`;

    await rateLimiter.consume(key);
    return next();
  } catch (err) {
    const ms = err?.msBeforeNext ?? 0;
    const sec = Math.max(1, Math.ceil(ms / 1000));
    res.setHeader('Retry-After', String(sec));
    return res.status(429).json({ success: false, status: 429, message: 'Too many requests' });
  }
}

// Export a stricter limiter for login endpoint(s). It enforces limits by IP and by account (email) when provided.
export async function loginRateLimitMiddleware(req, res, next) {
  try {
    // Exempt health/uploads from login limiter (defensive)
    if (req.path === '/health' || req.path.startsWith('/uploads')) return next();

    const ipKey = `ip:${getIp(req)}`;
    // consume for IP first
    await loginLimiter.consume(ipKey);

    // also consume per-account when email is available in body
    const email = req.body?.email ? String(req.body.email).toLowerCase() : null;
    if (email) {
      const acctKey = `loginacct:${email}`;
      await loginLimiter.consume(acctKey);
    }

    return next();
  } catch (err) {
    const ms = err?.msBeforeNext ?? 0;
    const sec = Math.max(1, Math.ceil(ms / 1000));
    res.setHeader('Retry-After', String(sec));
    return res.status(429).json({ success: false, status: 429, message: 'Too many login attempts' });
  }
}
