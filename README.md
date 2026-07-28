# Job Portal API (Node.js + Express + Prisma + MySQL)

This is the backend for the Job Portal. It uses Prisma ORM with MySQL and Joi for validation.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install deps and generate client:

```bash
npm install
npm run generate
```

3. Run migrations (creates the DB schema):

```bash
npm run migrate
```

4. Start the server:

```bash
npm run dev
```

API runs at http://localhost:4000

## Endpoints

- GET /health
- Jobs
  - GET /api/jobs?q&location&type&page&pageSize
  - GET /api/jobs/:slug
  - POST /api/jobs
  - PATCH /api/jobs/:slug
  - DELETE /api/jobs/:slug
- Companies
  - GET /api/companies
  - GET /api/companies/:id
  - POST /api/companies
  - PATCH /api/companies/:id
  - DELETE /api/companies/:id
- Services (procurements & scholarships)
  - GET /api/services?type&status&q&cityId&featured&page&pageSize
  - GET /api/services/:id
  - POST /api/services
  - PATCH /api/services/:id
  - DELETE /api/services/:id
- Categories
  - GET /api/categories
  - GET /api/categories/:id
  - POST /api/categories
  - PATCH /api/categories/:id
  - DELETE /api/categories/:id
- Cities
  - GET /api/cities
  - GET /api/cities/:id
  - POST /api/cities
  - PATCH /api/cities/:id
  - DELETE /api/cities/:id
- Advertisements
  - GET /api/ads?placement&activeOnly&limit
  - GET /api/ads/:id
  - POST /api/ads
  - PATCH /api/ads/:id
  - DELETE /api/ads/:id
- Users
  - GET /api/users?q&role&page&pageSize
  - GET /api/users/:id
  - POST /api/users
  - PATCH /api/users/:id
  - DELETE /api/users/:id
- Maintenance (Admin/Employee)
  - POST /api/maintenance/cleanup-expired?before&dryRun&limit
- Applications
  - GET /api/applications/jobs?jobId&userId&status&page&pageSize
  - POST /api/applications/jobs
  - GET /api/applications/services?serviceId&userId&status&page&pageSize
  - POST /api/applications/services
- Settings
  - GET /api/settings
  - GET /api/settings/:key
  - PUT /api/settings/:key

## Notes

- `skills` is stored as a comma-separated string for simplicity; adapt to a relation if needed.
- `type` is an enum (`full_time`, `part_time`, `contract`, `internship`, `temporary`, `remote`).
- Ads: use `placement` values `job_list_top|middle_of_job_list|home_page_after_pagenation_1|home_page_after_pagenation_2|middle_of_related_jobs_on_job_details|company_list_top|middle_of_company_list|middle_of_related_companies_on_company_details|service_list_top|middle_of_service_list|middle_of_related_services_on_service_details`. `activeOnly=true` returns only currently active ads by `startAt/endAt` window.
- Roles: `common` (default), `company`, `admin`, `employee`. Company users can post jobs/services; common users can apply; admins/employees can manage site content and settings.
- Settings: Use key/value or JSON for site configurations. Theme is no longer stored here (frontend ui-context).

## Prisma and Scaling (recommendations)

If you run this API in production with Prisma + MySQL, follow these recommendations to scale safely:

- Connection pooling

  - Avoid creating a new `PrismaClient` per request. This repo exports a single shared client in `src/lib/prisma.js`.
  - Use a managed pool/proxy where possible (Prisma Data Proxy, ProxySQL, or RDS Proxy on AWS) to reduce open connections to your MySQL server.
  - Tune your DB's `max_connections` and the pool size per application instance. When running multiple Node.js instances, multiply the per-instance pool size by instance count to estimate connection needs.

- Query optimization

  - Add database indexes for frequently queried columns (e.g., `Job.title`, `Job.type`, `Job.status`, `Notification.createdById`, `NotificationRecipient.userId`).
  - Use `select` or narrow `include` to fetch only required fields for each endpoint.
  - Batch related reads/writes with `prisma.$transaction` when possible to reduce round trips.
  - Monitor slow queries and adjust queries or add indexes. This repo enables basic Prisma query logging and slow-query warnings in `src/lib/prisma.js`.

- Horizontal scaling

  - Prisma works behind multiple Node.js instances or clusters. Ensure your DB and pooling strategy can handle the aggregate connections.
  - Consider read replicas for heavy read workloads and route read-only queries appropriately.

- Other tips
  - Prefer `findMany` with proper `where` filters and pagination (or full-array responses where appropriate) to avoid scanning large tables.
  - For extremely high throughput, consider caching layers (Redis) or materialized views for expensive aggregates.

These steps will help the API handle larger traffic safely while keeping DB load predictable.
