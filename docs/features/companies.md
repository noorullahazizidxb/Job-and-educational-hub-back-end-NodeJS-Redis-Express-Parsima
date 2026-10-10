# Companies

`src/routes/companies.js` → `src/services/companies.controller.js`. Schema: `src/validation/companies.schema.js`.

```mermaid
flowchart LR
  list[GET /api/companies]
  one[GET /:id or slug]
  write[POST PATCH]
  remove[DELETE]
  list --> controller[CompaniesController]
  one --> controller
  write --> role[company admin employee]
  remove --> admin[admin employee]
  role --> controller
  admin --> controller
  controller --> prisma[Prisma Company]
```

A company user is tied to `User.companyId`. City is an optional relation.
