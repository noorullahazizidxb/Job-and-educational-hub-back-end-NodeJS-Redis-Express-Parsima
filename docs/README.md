# Jobs hosting guide

This backend (Express + Prisma) and the customer Next.js app can be hosted in three ways. Pick one:

| Method | Best when | Redis / Elasticsearch / Socket.IO |
| --- | --- | --- |
| [Vercel](./vercel-deployment.md) | You only have a domain (`jobs.devminds.net`) and no VPS | Forced **off** (`HOSTING_PLATFORM=vercel`) |
| [Docker Compose](./docker.md) | You want the full stack (MySQL, Redis, ES) on one machine | **On** (compose provides them) |
| [Ubuntu server](./ubuntu.md) | You have a VPS and want nginx + Node/PM2 | **On** if you install Redis/ES yourself |

Scripts live in [`../scripts`](../scripts).

- Domain: `https://jobs.devminds.net`
- Backend on Vercel is reached at `https://jobs.devminds.net/backend` (Next.js rewrite)
- Backend on Docker/Ubuntu is usually `http://SERVER:4001` or a reverse-proxied path
