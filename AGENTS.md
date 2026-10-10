# Agents — Jobs API

Use this file before changing or deploying the API. Feature diagrams live in [docs/features](docs/features/README.md).

## Layout

- `src/index.js` — long-running server. Skipped when `VERCEL=1`.
- `api/index.js` — Vercel serverless entry. `maxDuration` is 10 (Hobby).
- `src/app.js` — Express app and route mounts.
- `src/routes/*.js` — HTTP mapping. `src/services/*.controller.js` — business logic.
- `src/validation/*.schema.js` — Joi.
- `src/lib/runtime.js` — hosting flags. `src/lib/prisma.js` — one shared client.
- `prisma.config.ts` — picks schema and migrations from `DB_PROVIDER`.

Import the shared Prisma, Redis, and search clients. Do not construct a new client per request.

## Env switches (free now, paid later)

Set these in `.env` or the Vercel project. Code reads them; do not hardcode hosts.

| Variable | Free Vercel | Later paid / VPS |
| --- | --- | --- |
| `HOSTING_PLATFORM` | `vercel` | `local` |
| `DB_PROVIDER` | `postgresql` | `mysql` or `postgresql` |
| `DATABASE_URL` | Neon pooled URL | Your SQL URL |
| `REDIS_ENABLED` / `REDIS_URL` | `false` (forced off on Vercel) | `true` + URL |
| `SEARCH_ENABLED` / `ELASTICSEARCH_URL` | `false` (forced off) | URL of a cluster |
| `SOCKET_IO_ENABLED` | `false` (forced off) | `true` |
| `BLOB_READ_WRITE_TOKEN` | empty (tmp uploads) | Vercel Blob token |
| `JWT_SECRET` `CRON_SECRET` | long random strings | same |

On Vercel, Redis, search, sockets, and queues stay off even if a URL is present. That avoids a leftover Redis URL breaking serverless. Turn them on by hosting on a VPS with `HOSTING_PLATFORM=local`.

## Deploy

Free Vercel (domain only, plus Neon free Postgres):

```bash
npx vercel login
npx vercel link --yes --project jobs-hub-api
npx vercel integration add neon --name jobs-hub-db --plan free_v3 -m region=fra1 -m auth=false --no-env-pull
# set HOSTING_PLATFORM, DB_PROVIDER, JWT_SECRET, CRON_SECRET, CORS_ORIGIN
npx vercel --prod --yes
```

Guide: [docs/vercel-deployment.md](docs/vercel-deployment.md).

VPS: [docs/ubuntu.md](docs/ubuntu.md). Docker: [docs/docker.md](docs/docker.md). Frontend path is `jobAndEducation-Hub-Next-JS-Final_Branch`. Public domain `jobs.devminds.net` belongs to the Next.js project. This API is called through the `/backend` rewrite.

## When editing a feature

1. Read the matching file under `docs/features/`.
2. Change the route, Joi schema, and controller together.
3. Keep the JSON envelope and role checks (`requireRole`, `requireAdmin`).
4. If the public path or body changes, update the frontend API client in the same change.
