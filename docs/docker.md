# Docker hosting — Jobs API + customer Next.js

Use this when you want MySQL, Redis, Elasticsearch, Socket.IO, and local uploads on one host. `HOSTING_PLATFORM` stays `local` (default). Compose does **not** force Vercel overrides.

## Layout

Compose file: [`../docker-compose.yml`](../docker-compose.yml) in this backend repo. The frontend image is built from `FRONTEND_PATH`.

| Service | Host port |
| --- | --- |
| frontend (Next.js) | 3000 |
| backend (Express) | 4001 |
| MySQL | 3306 |
| Redis | 16379 |
| Elasticsearch | 9200 |
| Kibana (optional `--profile tools`) | 5601 |

## Quick start

```bash
cd Job-and-educational-hub-back-end-NodeJS-Redis-Express-Parsima-main
cp .env.compose.example .env.compose
```

Set at least:

```bash
FRONTEND_PATH=/absolute/path/to/jobAndEducation-Hub-Next-JS-Final_Branch
MYSQL_ROOT_PASSWORD=change-me
REDIS_PASSWORD=change-me
ES_PASSWORD=change-me
JWT_SECRET=change-me-long
NEXT_PUBLIC_API_BASE=http://YOUR_HOST:4001
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
DB_PROVIDER=mysql
```

On Windows Docker Desktop, `FRONTEND_PATH` can be `C:/Jobs-Apps/jobAndEducation-Hub-Next-JS-Final_Branch`.

Then:

```bash
bash scripts/docker-up.sh
```

Or:

```bash
docker compose --env-file .env.compose up --build -d
```

Browser: `http://HOST:3000` — API from the browser: `http://HOST:4001`. SSR inside Compose uses `API_INTERNAL_URL=http://backend:4001`.

Apply schema (first time, from a one-off backend container or with `DATABASE_URL` pointed at published `3306`):

```bash
export DB_PROVIDER=mysql
export DATABASE_URL='mysql://root:PASSWORD@127.0.0.1:3306/job_service_db'
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

## Backend image only

```bash
docker build -t jobs-api .
docker run --rm -p 4001:4001 --env-file .env jobs-api
```

The image listens on **4001** (`EXPOSE 4001`, `CMD node src/index.js`). Provide `DATABASE_URL`, `JWT_SECRET`, and optionally `REDIS_URL` / `ELASTICSEARCH_URL`.

## Frontend image only

From the Next.js repo:

```bash
bash scripts/docker-build.sh
```

`NEXT_PUBLIC_API_BASE` is a **build-arg** and is baked into the client bundle.

## Production notes

- Change all compose default passwords.
- Put nginx or Caddy in front for TLS (`jobs.devminds.net` → `:3000`, `/backend` or `api.` → `:4001`).
- Persist volumes: `mysql_data`, `redis_data`, `es_data`, `uploads_data`.
- Do not use `HOSTING_PLATFORM=vercel` in Compose or you will disable Redis/ES/WebSockets.
