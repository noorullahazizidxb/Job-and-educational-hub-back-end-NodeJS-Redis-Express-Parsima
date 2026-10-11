import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

/**
 * Prisma configuration for this API.
 *
 * DB_PROVIDER selects the schema and migration folder:
 *   sqlite      → prisma/sqlite/schema.prisma + SQLITE_URL
 *   postgresql  → prisma/postgres/schema.prisma + DATABASE_URL
 *   mysql       → prisma/mysql/schema.prisma + DATABASE_URL (default)
 *
 * `.env` is the local file. Empty database URLs are filled from
 * `.env.production` so Postgres commands still resolve on Windows,
 * where `VAR=value command` does not set the variable.
 *
 * Prisma 7 reads the Migrate connection from `datasource.url` here.
 * Schema files only name the provider. Runtime queries use a driver
 * adapter in src/lib/prisma.js, with the pooled URL for Postgres.
 */

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && value !== "[SENSITIVE]") values[key] = value;
  }
  return values;
}

function pick(key: string, ...sources: Array<Record<string, string>>): string {
  const current = process.env[key];
  if (current && current !== "[SENSITIVE]") return current;
  for (const source of sources) {
    if (source[key]) return source[key];
  }
  return "";
}

const localEnv = readEnvFile(".env");
const productionEnv = readEnvFile(".env.production");

const localProvider = (localEnv.DB_PROVIDER || "").toLowerCase();
const provider = (process.env.DB_PROVIDER || localProvider || productionEnv.DB_PROVIDER || "mysql")
  .toLowerCase();
const useSQLite = provider === "sqlite";
const usePostgres = provider === "postgresql" || provider === "postgres";
const localIsPostgres = localProvider === "postgresql" || localProvider === "postgres";

const databaseUrl = useSQLite
  ? pick("SQLITE_URL", localEnv, productionEnv) || "file:./dev.db"
  : usePostgres && !localIsPostgres
    ? productionEnv.DATABASE_URL || pick("DATABASE_URL", localEnv)
    : pick("DATABASE_URL", localEnv, productionEnv);

const directUrl = usePostgres
  ? pick("DATABASE_URL_UNPOOLED", productionEnv, localEnv) ||
    pick("POSTGRES_URL_NON_POOLING", productionEnv, localEnv) ||
    pick("DIRECT_URL", localEnv, productionEnv) ||
    databaseUrl
  : "";

process.env.DB_PROVIDER = provider;
if (useSQLite) process.env.SQLITE_URL = databaseUrl;
if (!useSQLite && databaseUrl) process.env.DATABASE_URL = databaseUrl;

// Migrate must use a direct connection. Postgres runtime queries stay on the pooled URL.
const migrateUrl = usePostgres ? directUrl || databaseUrl : databaseUrl;

export default defineConfig({
  schema: useSQLite
    ? "prisma/sqlite/schema.prisma"
    : usePostgres
      ? "prisma/postgres/schema.prisma"
      : "prisma/mysql/schema.prisma",
  migrations: {
    path: useSQLite
      ? "prisma/migrations-sqlite"
      : usePostgres
        ? "prisma/migrations-postgres"
        : "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: migrateUrl,
  },
});
