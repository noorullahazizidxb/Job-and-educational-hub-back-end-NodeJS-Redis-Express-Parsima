#!/usr/bin/env node
import 'dotenv/config';
import { backfillAllIndices } from '../src/lib/searchIndexer.js';

(async () => {
  try {
    console.log('Starting Elasticsearch backfill...');
    const r = await backfillAllIndices();
    console.log('Backfill result:', r);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err?.message || err);
    process.exit(2);
  }
})();
