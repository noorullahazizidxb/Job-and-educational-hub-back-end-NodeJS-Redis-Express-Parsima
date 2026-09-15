import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma configuration.
 *
 * Switch SQL engines with DB_PROVIDER:
 *   DB_PROVIDER=sqlite       → prisma/schema.sqlite.prisma + SQLITE_URL
 *   DB_PROVIDER=postgresql   → prisma/schema.postgres.prisma + DATABASE_URL
 *   DB_PROVIDER=mysql        → prisma/schema.prisma + DATABASE_URL  (default)
 */
const provider = String(process.env.DB_PROVIDER || "mysql").toLowerCase();
const useSQLite = provider === "sqlite";
const usePostgres = provider === "postgresql" || provider === "postgres";

export default defineConfig({
  schema: useSQLite
    ? "prisma/schema.sqlite.prisma"
    : usePostgres
      ? "prisma/schema.postgres.prisma"
      : "prisma/schema.prisma",

  migrations: {
    path: useSQLite
      ? "prisma/migrations-sqlite"
      : usePostgres
        ? "prisma/migrations-postgres"
        : "prisma/migrations",
    seed: "node prisma/seed.js",
  },

  datasource: {
    url: useSQLite
      ? (process.env.SQLITE_URL ?? "file:./dev.db")
      : (process.env.DATABASE_URL ?? ""),
  },
});
