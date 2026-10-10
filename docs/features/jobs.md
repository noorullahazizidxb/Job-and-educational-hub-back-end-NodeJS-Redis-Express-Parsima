# Jobs

`src/routes/jobs.js` → `src/services/jobs.controller.js`. Schema: `src/validation/jobs.schema.js`.

```mermaid
flowchart LR
  publicGet[GET / and /featured and /:slug]
  companyWrite[POST PATCH DELETE]
  views[POST /:slug/views]
  reviews[GET and POST /:slug/reviews]
  publicGet --> controller[JobsController]
  companyWrite --> role[company admin employee]
  role --> controller
  views --> controller
  reviews --> controller
  controller --> prisma[Prisma Job]
  controller --> index[indexJobById when search is on]
```

List filters include `q`, `location`, `type`, `page`, `pageSize`. `type` is `full_time`, `part_time`, `contract`, `internship`, `temporary`, or `remote`. Skills are a comma-separated string. Public GETs send `Cache-Control: public, max-age=60`.
