function envFlag(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isTrue(value) {
  return ['1', 'true', 'yes', 'on'].includes(envFlag(value));
}

function isFalse(value) {
  return ['0', 'false', 'no', 'off'].includes(envFlag(value));
}

export const hostingPlatform = envFlag(process.env.HOSTING_PLATFORM) || 'local';
export const isVercelRuntime = isTrue(process.env.VERCEL);
export const isVercel = hostingPlatform === 'vercel' || isVercelRuntime;

/** Redis is on locally unless REDIS_ENABLED=false. Forced off on Vercel. */
export const redisEnabled = !isVercel && !isFalse(process.env.REDIS_ENABLED);

/** Elasticsearch is on only with a URL and SEARCH_ENABLED not false. Forced off on Vercel. */
export const searchEnabled =
  !isVercel &&
  !isFalse(process.env.SEARCH_ENABLED) &&
  Boolean(process.env.ELASTICSEARCH_URL);

/** Socket.IO is on locally unless SOCKET_IO_ENABLED=false. Forced off on Vercel. */
export const socketEnabled = !isVercel && !isFalse(process.env.SOCKET_IO_ENABLED);

/** BullMQ needs Redis. Forced off on Vercel. */
export const queueEnabled = redisEnabled;

export const blobEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function corsOrigins() {
  const raw = String(process.env.CORS_ORIGIN || process.env.SOCKET_IO_CORS_ORIGIN || '*').trim();
  if (!raw || raw === '*') return true;
  const list = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  return list.length ? list : true;
}

export function runtimeSummary() {
  return {
    hostingPlatform: isVercel ? 'vercel' : hostingPlatform,
    dbProvider: process.env.DB_PROVIDER || 'mysql',
    redisEnabled,
    searchEnabled,
    socketEnabled,
    queueEnabled,
    blobEnabled,
  };
}
