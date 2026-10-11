# Jobs API

Express + Prisma API for the Jobs hub (`jobs.devminds.net`). The customer app is `jobAndEducation-Hub-Next-JS-Final_Branch`. On the public site the API is reached at `https://jobs.devminds.net/backend`.

## Local

```bash
cp env-examples/vps.env.example .env
npm install
npm run generate
npm run migrate
npm run dev
```

API: http://localhost:4000 — health: `GET /health`.

`DB_PROVIDER` selects the schema:

- `mysql` (default) — `prisma/mysql/schema.prisma`
- `postgresql` — `prisma/postgres/schema.prisma` (Neon on Vercel)
- `sqlite` — `prisma/sqlite/schema.prisma`
- `turso` — same SQLite schema, runtime adapter `@prisma/adapter-libsql`

Hosting profiles live in `env-examples/`.

## Free Vercel vs a VPS

| | Free Vercel | VPS or Docker |
| --- | --- | --- |
| Flag | `HOSTING_PLATFORM=vercel` | `HOSTING_PLATFORM=local` |
| Database | Neon Postgres (`DB_PROVIDER=postgresql`) | MySQL or Postgres |
| Redis, Elasticsearch, Socket.IO, BullMQ | Forced off | On when the URL or flag is set |
| Function time | 10 seconds (Hobby) | Long-running Node |

Paid extras stay in `.env`. Do not fork the code to turn them on. See [docs/vercel-deployment.md](docs/vercel-deployment.md), [docs/ubuntu.md](docs/ubuntu.md), and [docs/docker.md](docs/docker.md).

```bash
bash scripts/deploy-vercel.sh
```

## Routes

Mounted in `src/app.js`. Responses use `{ success, status, entity, message }` from `responseEnvelope`, except `/health`.

- `GET /health`
- `/api/auth` — login, current user
- `/api/jobs` `/api/companies` `/api/services`
- `/api/categories` `/api/cities` `/api/ads`
- `/api/users` `/api/applications` `/api/settings`
- `/api/notifications` `/api/reviews` `/api/stats` `/api/reports`
- `/api/contacts` `/api/maintenance`

Feature diagrams: [docs/features](docs/features/README.md). Agent index: [AGENTS.md](AGENTS.md).

## Roles

`common` applies. `company` posts jobs and services. `admin` and `employee` manage the site.
