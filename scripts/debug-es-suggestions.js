import 'dotenv/config';
import { getEsClient, isSearchEnabled } from '../src/lib/elasticsearch.js';
import { INDEX } from '../src/lib/searchIndexer.js';

async function run() {
  if (!isSearchEnabled()) {
    console.log('Elasticsearch is not enabled. Set ELASTICSEARCH_URL in .env to enable.');
    return;
  }
  const client = await getEsClient();
  if (!client) return console.log('Failed to initialize ES client');

  const indices = Object.values(INDEX);
  for (const idx of indices) {
    try {
      const exists = await client.indices.exists({ index: idx });
      console.log(`\nIndex: ${idx} - exists: ${exists}`);
      if (!exists) continue;
      // print mapping keys for quick check
      try {
        const mapping = await client.indices.getMapping({ index: idx });
        const props = mapping[idx]?.mappings?.properties || mapping.body?.[idx]?.mappings?.properties || {};
        console.log('  mapping properties:', Object.keys(props).join(', '));
      } catch (e) { /* ignore mapping read errors */ }

      // count docs
      try {
        const c = await client.count({ index: idx });
        const count = c?.count ?? c?.body?.count ?? 'unknown';
        console.log(`  doc count: ${count}`);
      } catch (e) { console.log('  count error:', e.message || e); }

      // fetch a few sample docs via match_all
      try {
        const resp = await client.search({ index: idx, size: 5, query: { match_all: {} } });
        const hits = resp?.hits?.hits || [];
        if (!hits.length) {
          console.log('  no sample docs returned');
          continue;
        }
        console.log('  sample suggestion candidates:');
        for (const h of hits) {
          const s = h._source || h.source || {};
          let candidate = null;
          if (idx === (process.env.ES_INDEX_COMPANIES || 'companies')) candidate = s.name;
          else if (idx === (process.env.ES_INDEX_JOBS || 'jobs')) candidate = s.title;
          else if (idx === (process.env.ES_INDEX_SERVICES || 'services')) candidate = s.title || s.organization;
          else if (idx === (process.env.ES_INDEX_USERS || 'users')) candidate = s.name || s.email;
          else if (idx === (process.env.ES_INDEX_APPLICATIONS || 'applications')) candidate = s.fullName || s.email;
          console.log('   -', candidate, JSON.stringify(s));
        }
      } catch (e) { console.log('  sample fetch error:', e.message || e); }
    } catch (e) {
      console.log('Index check failed for', idx, e?.message || e);
    }
  }
}

run().catch((e) => { console.error('debug script failed', e?.message || e); process.exit(1); });
