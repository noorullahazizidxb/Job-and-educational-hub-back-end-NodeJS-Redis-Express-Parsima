import 'dotenv/config';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { closeRedis } from '../src/lib/redis.js';
import { registerGracefulShutdown } from '../src/lib/shutdown.js';
import logger from '../src/utils/logger.js';

export const maxDuration = 10;
export const config = {
  api: {
    bodyParser: false,
  },
};

// Vercel sends SIGTERM before an instance is torn down and allows ~500ms for cleanup.
registerGracefulShutdown({ cleanups: [closeRedis, () => prisma.$disconnect()], timeoutMs: 400, logger });

export default app;
