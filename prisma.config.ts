import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma v6 configuration.
 *
 * Switch between MySQL (production default) and SQLite (local dev) by setting:
 *   DB_PROVIDER=sqlite   → uses prisma/schema.sqlite.prisma + SQLITE_URL
 *   DB_PROVIDER=mysql    → uses prisma/schema.prisma        + DATABASE_URL  (default)
 *
 * Example .env entries:
 *   DB_PROVIDER=sqlite
 *   SQLITE_URL=file:./dev.db
 */
const useSQLite = process.env.DB_PROVIDER === "sqlite";

export default defineConfig({
  schema: useSQLite ? "prisma/schema.sqlite.prisma" : "prisma/schema.prisma",

  migrations: {
    path: useSQLite ? "prisma/migrations-sqlite" : "prisma/migrations",
    seed: "node prisma/seed.js",
  },

  datasource: {
    url: useSQLite
      ? (process.env.SQLITE_URL ?? "file:./dev.db")
      : (process.env.DATABASE_URL ?? ""),
  },
});
