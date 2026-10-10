# Maintenance

`src/routes/maintenance.js` → `src/services/maintenance.controller.js`. Cron auth uses `CRON_SECRET`.

```mermaid
flowchart TD
  cron[Vercel cron 02:30 UTC]
  admin[Admin POST /reindex-all]
  cron --> cleanup[GET or POST /cleanup-expired]
  cleanup --> guard[Bearer CRON_SECRET or admin]
  admin --> role[requireAdmin]
  guard --> job[delete rows past closingDate plus CLEANUP_AFTER_DAYS]
  role --> es[reindex when search is on]
```

`CLEANUP_DRY_RUN=true` lists without deleting. On a VPS the repeatable job is `src/queue/cleanupScheduler.js` instead of Vercel Cron. Reindex is a no-op while `SEARCH_ENABLED` is forced off.
