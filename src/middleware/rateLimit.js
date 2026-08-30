import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisPassword = process.env.REDIS_PASSWORD || undefined;
let redisClient;
if (redisPassword) {
  const url = new URL(redisUrl);
  redisClient = new Redis({
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: redisPassword,
    lazyConnect: true,
  });
} else {
  redisClient = new Redis(redisUrl, { lazyConnect: true });
}
redisClient.on("error", () => {
  /* silenced — memory fallback handles it */
});

// Default global limiter: Allow requests per IP/user per duration (tunable via env)
const points = Number(process.env.RATE_LIMIT_POINTS) || 100;
const duration = Number(process.env.RATE_LIMIT_DURATION) || 60;

// Memory fallback used when Redis is unavailable (local dev, no Redis running)
const memoryFallback = new RateLimiterMemory({ points, duration });

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "rlflx",
  points,
  duration,
  insuranceLimiter: memoryFallback,
});

// Dedicated, stricter limiter for login attempts
const loginPoints = Number(process.env.LOGIN_RATE_LIMIT_POINTS) || 5;
const loginDuration = Number(process.env.LOGIN_RATE_LIMIT_DURATION) || 15 * 60;
const loginMemFallback = new RateLimiterMemory({
  points: loginPoints,
  duration: loginDuration,
});
const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "rlflx_login",
  points: loginPoints,
  duration: loginDuration,
  insuranceLimiter: loginMemFallback,
});

function getIp(req) {
  // prefer x-forwarded-for when behind proxies/load balancers
  const xf = req.headers["x-forwarded-for"];
  if (xf && typeof xf === "string") return xf.split(",")[0].trim();
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export default async function rateLimitMiddleware(req, res, next) {
  try {
    // Exempt health check and static uploads from global limiting
    if (req.path === "/health" || req.path.startsWith("/uploads"))
      return next();

    // Use authenticated user id when available, otherwise fall back to IP
    const userId = req.user?.id ?? req.user?.sub ?? null;
    const key = userId ? `user:${String(userId)}` : `ip:${getIp(req)}`;

    await rateLimiter.consume(key);
    return next();
  } catch (err) {
    const ms = err?.msBeforeNext ?? 0;
    const sec = Math.max(1, Math.ceil(ms / 1000));
    res.setHeader("Retry-After", String(sec));
    return res
      .status(429)
      .json({ success: false, status: 429, message: "Too many requests" });
  }
}

// Export a stricter limiter for login endpoint(s). It enforces limits by IP and by account (email) when provided.
export async function loginRateLimitMiddleware(req, res, next) {
  try {
    // Exempt health/uploads from login limiter (defensive)
    if (req.path === "/health" || req.path.startsWith("/uploads"))
      return next();

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
    res.setHeader("Retry-After", String(sec));
    return res
      .status(429)
      .json({
        success: false,
        status: 429,
        message: "Too many login attempts",
      });
  }
}
