# Free Vercel — Jobs API + customer Next.js

Two Vercel projects. One public domain: `https://jobs.devminds.net`.

Vercel is serverless. Redis, Elasticsearch, Socket.IO, and BullMQ cannot stay always-on. `HOSTING_PLATFORM=vercel` forces them off. The database is Neon Postgres on the free plan (`free_v3`). SQLite will not persist.

Hobby functions are capped at 10 seconds (`maxDuration` in `vercel.json` and `api/index.js`). A paid Vercel plan is what lets you raise that number.

```text
Browser → jobs.devminds.net          (Next.js project + custom domain)
              ├── /                  pages
              └── /backend/*  rewrite →  jobs-hub-api.vercel.app
                                              └── Neon Postgres
```

Frontend repo: `jobAndEducation-Hub-Next-JS-Final_Branch`.
API project name: `jobs-hub-api`.

## 1. Accounts

- Vercel CLI already used by `npx vercel login`
- Neon through the Vercel marketplace (free plan). Accept terms once: `vercel integration accept-terms neon` or the URL the CLI prints
- Domain DNS at Hostinger for `devminds.net`

## 2. Database

From this repo, after `npx vercel link --yes --project jobs-hub-api`:

```bash
npx vercel integration add neon --name jobs-hub-db --plan free_v3 -m region=fra1 -m auth=false --no-env-pull
```

`auth=false` keeps Neon Auth off. This API uses its own JWT.

Pull the URL into a gitignored file (do not overwrite local `.env`):

```bash
npx vercel env pull .env.vercel.production --environment production --yes
```

Migrate with the **unpooled** URL when Neon provides one (`DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING`). Runtime on Vercel should use the pooled URL.

```bash
export DB_PROVIDER=postgresql
export DATABASE_URL='postgresql://...unpooled...?sslmode=require'
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

## 3. API env

Paste the rest from `.env.vercel.example` into the `jobs-hub-api` project. Required:

- `HOSTING_PLATFORM=vercel`
- `DB_PROVIDER=postgresql`
- `DATABASE_URL` pooled Neon URL (the integration sets this)
- `JWT_SECRET` and `CRON_SECRET` long random strings
- `CORS_ORIGIN=https://jobs.devminds.net`
- `REDIS_ENABLED=false` `SEARCH_ENABLED=false` `SOCKET_IO_ENABLED=false`

Leave `REDIS_URL`, `ELASTICSEARCH_URL`, and `BLOB_READ_WRITE_TOKEN` empty until you pay for them or move to a VPS.

```bash
bash scripts/deploy-vercel.sh
```

Build runs `prisma generate`. Copy the `https://jobs-hub-api-....vercel.app` URL.

## 4. Frontend

In `jobAndEducation-Hub-Next-JS-Final_Branch`, set `.env.vercel.example` values on that Vercel project:

- `NEXT_PUBLIC_SITE_URL=https://jobs.devminds.net`
- `NEXT_PUBLIC_API_BASE=https://jobs.devminds.net/backend`
- `NEXT_PUBLIC_API_HOST=https://jobs.devminds.net`
- `BACKEND_VERCEL_URL` = the API URL, no trailing slash
- `NEXT_PUBLIC_SOCKET_IO_ENABLED=false`

`NEXT_PUBLIC_*` and `BACKEND_VERCEL_URL` are build-time. Redeploy after changing them.

```bash
bash scripts/deploy-vercel.sh
```

## 5. Domain and Hostinger

Attach `jobs.devminds.net` only to the **frontend** project.

In Hostinger DNS for `devminds.net`:

1. Delete the A record whose name is `jobs` and whose value is `188.245.221.222`.
2. Add a CNAME: name `jobs`, target `cname.vercel-dns.com` (use the exact target Vercel shows if it differs).

Do not also attach this hostname to `jobs-hub-api`. The Next.js rewrite `/backend/:path*` proxies to `BACKEND_VERCEL_URL`.

## 6. Check

- `https://jobs.devminds.net`
- `https://jobs.devminds.net/backend/health` → `ok: true`, `db: ok`, `runtime.hostingPlatform: vercel`

## What free Vercel does not do

- Live inbox over Socket.IO (HTTP inbox still works)
- Shared Redis rate limits and metric counters
- Elasticsearch (Prisma text filters still run)
- Durable `uploads/` unless `BLOB_READ_WRITE_TOKEN` is set

## Switch to paid or a VPS later

Change variables, do not fork code.

- VPS: `HOSTING_PLATFORM=local`, plus `REDIS_URL`, `ELASTICSEARCH_URL`, `SOCKET_IO_ENABLED=true`. See [ubuntu.md](ubuntu.md).
- Longer functions: paid Vercel plan, then set `maxDuration` above 10.
- Neon Launch/Scale: `vercel integration update` or `--plan launch_v3` on a new resource. Point `DATABASE_URL` at the new pooled string.
