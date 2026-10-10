# Reports

`src/routes/reports.js` → `src/services/reports.controller.js`. Admin only.

```mermaid
flowchart LR
  page[Admin reports page]
  page --> api[GET /api/reports]
  api --> role[requireRole admin]
  role --> controller[ReportsController.overview]
  controller --> prisma[counts for users jobs services applications]
```

The frontend charts today, this week, this month, a 30-day series, and top viewed jobs. CSV export is a frontend concern.
