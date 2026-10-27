import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { setupIndices } from './lib/searchIndexer.js';
import { closeWebSocket, initWebSocket } from './lib/ws.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';
import { registerGracefulShutdown } from './lib/shutdown.js';
import logger from './utils/logger.js';
import {
  isVercelRuntime,
  queueEnabled,
  searchEnabled,
  socketEnabled,
  runtimeSummary,
} from './lib/runtime.js';

const PORT = process.env.PORT || 4000;

export { app };

if (!isVercelRuntime) {
  const server = http.createServer(app);
  if (socketEnabled) initWebSocket(server);
  server.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log('runtime', runtimeSummary());
  });

  registerGracefulShutdown({
    // Socket.IO's close() also closes the HTTP server; ERR_SERVER_NOT_RUNNING is tolerated.
    server: { close: (cb) => closeWebSocket().then(() => server.close(cb)) },
    cleanups: [closeRedis, () => prisma.$disconnect()],
    timeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000,
    logger,
  });

  try {
    if (queueEnabled) {
      import('./queue/cleanupScheduler.js')
        .then(() => console.log('cleanup scheduler initialized'))
        .catch((e) => console.error('failed to init cleanup scheduler', e));
    } else {
      console.log('cleanup scheduler skipped (queues disabled)');
    }
    if (searchEnabled) {
      setupIndices().catch((e) => console.warn('search indices setup failed', e?.message || e));
    }
  } catch {
    // ignore; dynamic import failures should not stop the server
  }
}
