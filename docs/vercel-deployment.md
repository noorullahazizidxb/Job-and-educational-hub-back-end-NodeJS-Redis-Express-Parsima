# Overall Vercel deployment — Jobs API + customer Next.js

Two Vercel projects, one public domain: **`https://jobs.devminds.net`**.

Vercel is serverless. Redis, Elasticsearch, Socket.IO, and BullMQ workers **cannot** stay always-on. Set `HOSTING_PLATFORM=vercel` on the API so those extras are forced off. You still need a **hosted SQL database** (Neon Postgres hobby is free). A SQLite file on Vercel will not persist.

```text
Browser  →  jobs.devminds.net          (Next.js project + custom domain)
                │
                ├── /                  pages, assets
                ├── /api/*             Next.js route handlers
                └── /backend/*  ──rewrite──►  <api>.vercel.app   (Express project)
                                                    │
                                                    └── Neon Postgres (DATABASE_URL)
```

## Local Vercel-like test (this PC)

Does **not** need a Vercel login. Uses SQLite and the same flags as production (`HOSTING_PLATFORM=vercel`, Socket.IO off, `/backend` rewrite).

```bash
# from the backend repo — stop any existing :3000 / :4000 first
npm run dev:vercel
```

- Site: http://localhost:3000
- API through rewrite: http://localhost:3000/backend/health (`hostingPlatform: "vercel"`)
- Env files: `.env.vercel.local` in each repo (frontend also writes `.env.local` for Next)

For the real serverless emulator (needs `npx vercel login`): `npx vercel dev` in each repo.

---

## 1. Prerequisites

- [Vercel account](https://vercel.com) and [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- [Neon](https://neon.tech) (or any Postgres) connection string
- Domain `jobs.devminds.net` DNS you can edit
- This backend repo and the customer app: `jobAndEducation-Hub-Next-JS`

## 2. Database (once)

1. Create a Neon project.
2. Copy the pooled connection string.
3. From this backend repo (after `npm install`):

```bash
export DB_PROVIDER=postgresql
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/dbname?sslmode=require'
npx prisma generate
npx prisma migrate deploy
# optional:
npx prisma db seed
```

Or: `bash scripts/prisma-migrate.sh`

## 3. Deploy the backend (this repo)

```bash
cd Job-and-educational-hub-back-end-NodeJS-Redis-Express-Parsima-main
bash scripts/deploy-vercel.sh
```

The script links the project (first run) and deploys to production.

In the Vercel dashboard → **Settings → Environment Variables**, paste values from [`.env.vercel.example`](../.env.vercel.example):

| Variable | Value |
| --- | --- |
| `HOSTING_PLATFORM` | `vercel` |
| `DB_PROVIDER` | `postgresql` |
| `DATABASE_URL` | Neon URL |
| `JWT_SECRET` | long random string |
| `CORS_ORIGIN` | `https://jobs.devminds.net` |
| `CRON_SECRET` | random string (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`) |
| `BLOB_READ_WRITE_TOKEN` | optional, for persistent uploads |

Build command: `npm run build` (runs `prisma generate`). Entry: `api/index.js` via [`vercel.json`](../vercel.json). Daily cleanup: cron `GET /api/maintenance/cleanup-expired`.

Copy the backend URL, e.g. `https://job-portal-api-xxxx.vercel.app`.

## 4. Deploy the customer Next.js app

```bash
cd jobAndEducation-Hub-Next-JS
bash scripts/deploy-vercel.sh
```

Set env vars from that repo’s `.env.vercel.example`:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://jobs.devminds.net` |
| `NEXT_PUBLIC_API_BASE` | `https://jobs.devminds.net/backend` |
| `NEXT_PUBLIC_API_HOST` | `https://jobs.devminds.net` |
| `BACKEND_VERCEL_URL` | `https://<backend>.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_SOCKET_IO_ENABLED` | `false` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | optional |

`NEXT_PUBLIC_*` and `BACKEND_VERCEL_URL` are **build-time**. Redeploy after changing them.

## 5. Attach the domain

On the **frontend** Vercel project:

1. Settings → Domains → add `jobs.devminds.net` (and `www` if you use it).
2. At your DNS host, add the CNAME Vercel shows (usually `jobs` → `cname.vercel-dns.com`).
3. Do **not** also attach this domain to the backend project. The frontend rewrite `/backend/:path*` proxies to `BACKEND_VERCEL_URL`.

## 6. Verify

- Site: `https://jobs.devminds.net`
- API health: `https://jobs.devminds.net/backend/health` → `{ "ok": true, "db": "ok", "runtime": { "hostingPlatform": "vercel", ... } }`
- Login uses JWT against `/backend/api/auth/login`

## What Vercel mode does not do

- Live inbox over Socket.IO (REST/SWR still works)
- Redis-backed report charts and shared rate limits
- Elasticsearch suggestions (Prisma text search fallback)
- Persistent local `uploads/` unless `BLOB_READ_WRITE_TOKEN` is set

## Re-deploy later

```bash
# backend
bash scripts/deploy-vercel.sh

# frontend (after env or code changes)
bash scripts/deploy-vercel.sh
```
