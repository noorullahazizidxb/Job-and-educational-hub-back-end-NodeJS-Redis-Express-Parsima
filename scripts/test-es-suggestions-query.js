import 'dotenv/config';
import { getEsClient, isSearchEnabled } from '../src/lib/elasticsearch.js';
import { INDEX } from '../src/lib/searchIndexer.js';

async function check(index, q, fields, limit = 10) {
  const client = await getEsClient();
  const resp = await client.search({ index, size: 100, query: { multi_match: { query: q, fields } } });
  const hits = resp?.hits?.hits || [];
  const suggestions = [...new Set(hits.map(h => h._source).map(s => {
    if (!s) return null;
    if (s.title) return s.title;
    if (s.name) return s.name;
    if (s.fullName) return s.fullName;
    if (s.email) return s.email;
    return null;
  }).filter(Boolean))].slice(0, limit);
  console.log(`\nIndex: ${index} q='${q}' => suggestions:`, suggestions);
}

async function run() {
  if (!isSearchEnabled()) return console.log('ES not enabled');
  await check(INDEX.jobs, 'Frontend', ['title^3','description','skills^2','location']);
  await check(INDEX.services, 'Acme', ['title^3','description','tags','organization']);
  await check(INDEX.companies, 'Acme', ['name^3','industry','about','description']);
  await check(INDEX.users, 'Admin', ['name^3','email']);
  await check(INDEX.applications, 'Admin', ['fullName^3','email']);
}

run().catch(e => { console.error('error', e); process.exit(1); });
