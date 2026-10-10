import { readFileSync } from 'node:fs';

const text = readFileSync('.env.vercel.production', 'utf8');
const keys = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'DB_PROVIDER',
];

for (const key of keys) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) {
    console.log(`${key}: missing`);
    continue;
  }
  const value = match[1].replace(/^"|"$/g, '');
  console.log(
    `${key}: len=${value.length} pooler=${value.includes('-pooler')} postgres=${value.startsWith('postgres')} sensitive=${value.includes('SENSITIVE')}`,
  );
}
