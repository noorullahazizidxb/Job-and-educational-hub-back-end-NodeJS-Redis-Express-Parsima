# Applications

`src/routes/applications.js` → `src/services/applications.controller.js`. Schema: `src/validation/applications.schema.js`.

```mermaid
sequenceDiagram
  participant User as role common
  participant Api as POST /api/applications/jobs or /services
  participant Staff as admin or company
  User->>Api: cv and coverLetter
  Api-->>User: application row
  Staff->>Api: PATCH /jobs/:id/viewed shortlisted rejected hired withdrawn
  Staff->>Api: PATCH /services/:id same statuses
```

`GET /jobs` and `GET /services` are admin-only. Status changes are `admin` or `company`. Files use the shared `upload` middleware (`FILE_UPLOAD_LIMIT_BYTES`).
