import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const pulled = dotenv.parse(readFileSync('.env.vercel.production'));
const seed = dotenv.parse(readFileSync('.env.seed.local'));
const databaseUrl = pulled.DATABASE_URL_UNPOOLED || pulled.POSTGRES_URL_NON_POOLING;
if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
  console.error('Unpooled Postgres URL is missing from .env.vercel.production');
  process.exit(1);
}

const env = {
  ...process.env,
  DB_PROVIDER: 'postgresql',
  DATABASE_URL: databaseUrl,
  ADMIN_EMAIL: seed.ADMIN_EMAIL,
  ADMIN_PASSWORD: seed.ADMIN_PASSWORD,
};

function run(args) {
  const result = spawnSync('npx', args, { env, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['prisma', 'generate']);
run(['prisma', 'migrate', 'deploy']);
run(['prisma', 'db', 'seed']);
console.log('neon-migrate-ok');
