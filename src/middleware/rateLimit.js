import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import Redis from "ioredis";
import { redisEnabled } from "../lib/runtime.js";

const points = Number(process.env.RATE_LIMIT_POINTS) || 100;
const duration = Number(process.env.RATE_LIMIT_DURATION) || 60;
const loginPoints = Number(process.env.LOGIN_RATE_LIMIT_POINTS) || 5;
const loginDuration = Number(process.env.LOGIN_RATE_LIMIT_DURATION) || 15 * 60;

const memoryFallback = new RateLimiterMemory({ points, duration });
const loginMemFallback = new RateLimiterMemory({
  points: loginPoints,
  duration: loginDuration,
});

let rateLimiter = memoryFallback;
let loginLimiter = loginMemFallback;

if (redisEnabled) {
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

  rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "rlflx",
    points,
    duration,
    insuranceLimiter: memoryFallback,
  });
  loginLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "rlflx_login",
    points: loginPoints,
    duration: loginDuration,
    insuranceLimiter: loginMemFallback,
  });
}

function getIp(req) {
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
    if (req.path === "/health" || req.path.startsWith("/uploads"))
      return next();

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

export async function loginRateLimitMiddleware(req, res, next) {
  try {
    if (req.path === "/health" || req.path.startsWith("/uploads"))
      return next();

    const ipKey = `ip:${getIp(req)}`;
    await loginLimiter.consume(ipKey);

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
