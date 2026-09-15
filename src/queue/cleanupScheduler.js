import { createQueue, createWorker } from '../lib/queue.js';
import { queueEnabled } from '../lib/runtime.js';
import { runCleanup } from './dailyCleanup.js';

if (!queueEnabled) {
  console.log('cleanup scheduler skipped (Redis/queues disabled)');
}

// Create or reuse a queue for scheduled maintenance tasks
const q = createQueue('maintenance-tasks');

// Enqueue a repeatable job that runs once per day.
// Using cron-style repeat: daily at 02:30 UTC by default (can be overridden via env)
const cronExpr = process.env.CLEANUP_CRON || '30 2 * * *';

async function ensureRepeatable() {
  if (!queueEnabled) return;
  // Every call removes existing repeatable with same key and re-adds to ensure correctness
  await q.drain();
  await q.clean(0, 1000);
  await q.add('daily-cleanup', {}, { repeat: { cron: cronExpr, tz: process.env.CRON_TZ || 'UTC' } });
  console.log('Scheduled daily-cleanup cron=', cronExpr);
}

// Worker that actually runs cleanup when the job triggers
const w = createWorker('maintenance-tasks', async (job) => {
  if (job.name !== 'daily-cleanup') return;
  const envDry = String(process.env.CLEANUP_DRY_RUN || '').toLowerCase();
  const dryRun = envDry === '1' || envDry === 'true' || envDry === 'yes';
  console.log('maintenance-tasks running daily-cleanup (dryRun=' + dryRun + ')');
  try {
    const res = await runCleanup(dryRun);
    console.log('daily-cleanup result', res);
  } catch (e) {
    console.error('daily-cleanup failed', e?.message || e);
    throw e;
  }
});

w.on('failed', (job, err) => console.error('maintenance-tasks job failed', job.id, err?.message || err));

// Start scheduling when module is imported
ensureRepeatable().catch((e) => console.error('failed to schedule cleanup job', e));

export default { ensureRepeatable };
