# Users

`src/routes/users.js` → `src/services/users.controller.js`. Schema: `src/validation/users.schema.js`.

```mermaid
flowchart LR
  list[GET / and GET /:id]
  create[POST with photo]
  update[PATCH /:id with photo]
  remove[DELETE /:id]
  list --> admin[requireAdmin]
  remove --> admin
  create --> upload[uploadProfile]
  update --> upload
  admin --> controller[UsersController]
  upload --> controller
  controller --> prisma[Prisma User]
```

Roles: `common`, `company`, `admin`, `employee`. Photo limit: `PROFILE_UPLOAD_LIMIT_BYTES` (default 5MB). Seed admin comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
