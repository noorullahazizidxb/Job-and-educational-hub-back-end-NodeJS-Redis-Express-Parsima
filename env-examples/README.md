# API environment profiles

Copy one file to `.env` and fill the placeholders. These files are not loaded automatically.

| File | When to use |
| --- | --- |
| `free-vercel.env.example` | Free Vercel. Neon Postgres. Redis, search, and Socket.IO stay off. |
| `paid-vercel.env.example` | Paid Vercel. Same serverless limits, plus Vercel Blob. Raise `maxDuration` only on a paid plan. |
| `vps.env.example` | Ubuntu VPS. Redis and Socket.IO can stay on. |
| `docker.env.example` | Docker Compose on one host. |
| `neon.env.example` | Neon Postgres connection strings used by Vercel or a VPS. |
| `turso.env.example` | Turso (libSQL). Uses the SQLite schema. |
