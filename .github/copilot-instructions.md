# Copilot — Jobs API

Short guidance for the Express + Prisma Jobs API. The customer Next.js app is `jobAndEducation-Hub-Next-JS-Final_Branch`.

## CodeGraph

There is no `.codegraph/` index in this repo until someone runs `codegraph init`. Do not claim the graph exists. Diagrams in `docs/features/` are Mermaid from the files named in each doc. If an index is added later, query it only through the CodeGraph MCP (`codegraph_explore`) and do not open the `.codegraph/` folder.

## Commands

```bash
cp .env.example .env
npm install
npm run generate
npm run migrate
npm run dev
```

Health: `GET /health` runs `SELECT 1`.

## Architecture

- `src/index.js` listens only when not on Vercel. It starts Socket.IO, the cleanup scheduler, and Elasticsearch setup when those flags are on.
- `api/index.js` is the serverless entry. Hobby `maxDuration` is 10.
- `src/lib/prisma.js` is the only Prisma client.
- `src/lib/redis.js`, `src/lib/queue.js` (BullMQ, `maxRetriesPerRequest: null`), `src/lib/elasticsearch.js`, `src/lib/searchIndexer.js`, `src/lib/ws.js`.
- Routes in `src/routes/*.js`. Controllers in `src/services/*.controller.js`. Joi schemas in `src/validation/*.schema.js`.
- Errors: Joi (`err.isJoi`) becomes 400. Other errors use `status` and `message`. The envelope is `{ success, status, entity, message }`.
- WebSocket rooms: `user:ID` and `company:ID`. Emit with `getIO()` or `notifyUserInbox` from `src/lib/ws.js`.
- After writes that should be searchable, call the `index*ById` helpers in `src/lib/searchIndexer.js`. They no-op when search is off.

## Env

`HOSTING_PLATFORM=vercel` forces Redis, Elasticsearch, Socket.IO, and queues off. A VPS sets `HOSTING_PLATFORM=local` and then `REDIS_URL`, `ELASTICSEARCH_URL`, and `SOCKET_IO_ENABLED=true`. `DB_PROVIDER` is `mysql`, `postgresql`, or `sqlite`. Never commit secrets.

## Features

See `docs/features/README.md` and `AGENTS.md`. Deploy free Vercel: `docs/vercel-deployment.md`. VPS: `docs/ubuntu.md`. Docker: `docs/docker.md`.

## Do not

- Create a Prisma or Redis client per request.
- Enable Socket.IO on Vercel. It needs a long-running process.
- Attach `jobs.devminds.net` to this Vercel project. The Next.js project owns the domain and rewrites `/backend`.
