import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { setupIndices } from './lib/searchIndexer.js';
import { initWebSocket } from './lib/ws.js';
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
