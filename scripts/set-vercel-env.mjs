import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const jwt = randomBytes(32).toString('hex');
const cron = randomBytes(24).toString('hex');
const adminPassword = randomBytes(12).toString('base64url');

const shared = {
  HOSTING_PLATFORM: 'vercel',
  NODE_ENV: 'production',
  DB_PROVIDER: 'postgresql',
  JWT_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'https://jobs.devminds.net',
  REDIS_ENABLED: 'false',
  SEARCH_ENABLED: 'false',
  SOCKET_IO_ENABLED: 'false',
  JSON_LIMIT: '1mb',
  URLENCODED_LIMIT: '1mb',
  ADMIN_EMAIL: 'admin@jobs.devminds.net',
};

const sensitive = {
  JWT_SECRET: jwt,
  CRON_SECRET: cron,
  ADMIN_PASSWORD: adminPassword,
};

function add(name, value, isSecret) {
  const args = [
    'vercel',
    'env',
    'add',
    name,
    'production,preview',
    '--value',
    value,
    '--yes',
    '--force',
    isSecret ? '--sensitive' : '--no-sensitive',
  ];
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const [name, value] of Object.entries(shared)) add(name, value, false);
for (const [name, value] of Object.entries(sensitive)) add(name, value, true);

writeFileSync(
  '.env.seed.local',
  `ADMIN_EMAIL=${shared.ADMIN_EMAIL}\nADMIN_PASSWORD=${adminPassword}\nJWT_SECRET=${jwt}\nCRON_SECRET=${cron}\n`,
  { encoding: 'utf8' },
);
console.log('env-set-ok');
