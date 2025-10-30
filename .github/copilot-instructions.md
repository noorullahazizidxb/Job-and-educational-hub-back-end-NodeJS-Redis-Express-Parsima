## Purpose

Short, actionable guidance for AI coding agents working on the Job Portal backend.
Focus on the runtime wiring, common patterns, where to make changes, and how to run the project locally.

## Quick start / dev commands

- Copy `.env.example` -> `.env` and set `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL` (if used), and other secrets.
- Install deps / generate Prisma client:

  npm install
  npm run generate

- Apply migrations and seed (if needed):

  npm run migrate

- Start in dev: `npm run dev` (default API: http://localhost:4000)

Notes: health endpoint at `/health` performs a lightweight DB check (SELECT 1).

## High-level architecture (what matters)

- Express REST API entrypoint: `src/index.js` — sets up middleware, route mounts, WebSocket initialization and background init tasks (cleanup scheduler, ES indices setup).
- Prisma: `src/lib/prisma.js` exports a single shared `prisma` client instance. Do NOT create per-request Prisma clients; reuse this export.
- Redis: `src/lib/redis.js` exports a shared `redis` (ioredis) instance used for caching and session-like stores.
- Queues: `src/lib/queue.js` provides `createQueue(name)` and `createWorker(name, processor, opts)` (BullMQ + shared ioredis connection). BullMQ expects ioredis configured with `maxRetriesPerRequest: null`.
- Search: optional Elasticsearch integration lives in `src/lib/elasticsearch.js` and the indexer logic is in `src/lib/searchIndexer.js` (INDEX constants, mapJob/mapService helpers, bulkIndex/bulkDelete). `setupIndices()` is called at server start if `ELASTICSEARCH_URL` is set.
- WebSockets: `src/lib/ws.js` exports `initWebSocket(server)`, `getIO()`, and helper notifications (`notifyUserInbox`, `notifyCompanyInbox`). Socket auth accepts tokens via query/auth headers and attaches `socket.user`.
- Routes & controllers: routing files are under `src/routes/*.js` and map to controller logic in `src/services/*.controller.js` (convention: `routes` define HTTP mapping, controllers contain business logic).

## Coding conventions and patterns to follow (observable rules)

- Error handling: `src/index.js` has an Express error handler that normalizes Joi validation errors (err.isJoi). Return shapes follow the `responseEnvelope()` middleware — add `{ success, status, entity, message }` when appropriate.
- Validation: Joi schemas are in `validation/*.schema.js` and used by route/middleware; follow existing schema style and messages.
- Shared singletons: See `src/lib/prisma.js`, `src/lib/redis.js`, and ES/queue connection factories. Prefer importing and reusing the exported instances rather than creating new clients.
- Search index mappings: Update `src/lib/searchIndexer.js` for any changes in indexed fields or mapping rules; the file contains explicit `mapX` functions used for indexing. For applications index, note the composite _id pattern `type:id` to avoid collisions.
- Background jobs: scheduled/worker logic is under `queue/` and `src/lib/queue.js`. The main process dynamically imports `queue/cleanupScheduler.js` at startup — avoid duplicating scheduler instances.
- WebSocket rooms: per-user rooms use `user:ID` and company rooms use `company:ID` (see `src/lib/ws.js`). Use `getIO()` to emit events from controllers/services.

## Integrations and important env vars

- DATABASE_URL — Prisma/MySQL
- REDIS_URL / REDIS_PASSWORD — caching and BullMQ. BullMQ also uses `QUEUE_PREFIX`.
- ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, ES_COMPATIBILITY — optional search. If not set, search functions are no-ops.
- PRISMA_SLOW_QUERY_MS — threshold (ms) used by `src/lib/prisma.js` to warn about slow queries.

## Useful files to reference when editing features

- Server wiring: `src/index.js`
- DB client: `src/lib/prisma.js`
- Caching: `src/lib/redis.js`
- Queues: `src/lib/queue.js` and `queue/` directory
- Search: `src/lib/elasticsearch.js` and `src/lib/searchIndexer.js` (mappings + bulk helpers)
- WebSockets: `src/lib/ws.js`
- Routes: `src/routes/*.js`
- Controllers: `src/services/*.controller.js`
- Validation: `validation/*.schema.js`
- Middleware: `src/middleware/*` (authn, authz, rateLimit, response)

## Examples of "		,": small code hints and common fixes

- Use existing helpers: to emit a user notification from a controller, import `getIO()` or `notifyUserInbox` from `src/lib/ws.js` instead of direct Socket.IO references.
- When indexing after writes: call `indexJobById(id)` / `indexServiceById(id)` etc. from `src/lib/searchIndexer.js` rather than building ad-hoc bulk operations.
- Avoid serial DB calls in loops—use `prisma.$transaction` or batch operations in `searchIndexer.backfillAllIndices()` style.

## Tests, linting, and validation

- There are no automated tests in the repo by default. When adding tests, prefer fast unit tests that mock `prisma`/`redis`/`getEsClient()` still following the singleton pattern.

## When in doubt

- Preserve singletons and shared clients. If you need to change connection behavior, update `src/lib/*` helpers and keep call sites unchanged.
- Keep API shapes compatible with `responseEnvelope()` and controllers' existing return values.

---

If anything here is unclear or you'd like this document shortened or expanded (for example, add example code snippets for common changes like adding a new route + controller + indexer integration), tell me what to add or remove and I'll iterate.
