import 'dotenv/config';
import logger from '../utils/logger.js';
import { searchEnabled as runtimeSearchEnabled } from './runtime.js';

let clientInstance = null;

export function isSearchEnabled() {
  return runtimeSearchEnabled;
}

export async function getEsClient() {
  if (!isSearchEnabled()) return null;
  if (clientInstance) return clientInstance;
  const { Client } = await import('@elastic/elasticsearch');
  const { ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, ELASTICSEARCH_USERNAME, ELASTICSEARCH_PASSWORD, ES_COMPATIBILITY } = process.env;
  const auth = ELASTICSEARCH_API_KEY
    ? { apiKey: ELASTICSEARCH_API_KEY }
    : (ELASTICSEARCH_USERNAME || ELASTICSEARCH_PASSWORD
      ? { username: ELASTICSEARCH_USERNAME, password: ELASTICSEARCH_PASSWORD }
      : undefined);
  const compat = (ES_COMPATIBILITY === '7' || ES_COMPATIBILITY === '8') ? ES_COMPATIBILITY : '8';
  const headers = {
    accept: `application/vnd.elasticsearch+json; compatible-with=${compat}`,
    'content-type': `application/vnd.elasticsearch+json; compatible-with=${compat}`,
  };
  clientInstance = new Client({ node: ELASTICSEARCH_URL, auth, tls: { rejectUnauthorized: false }, headers });
  try {
    await clientInstance.info();
    logger.info('Elasticsearch client initialized');
  } catch (e) {
    logger.warn('Elasticsearch connection check failed: ' + (e?.message || e));
  }
  return clientInstance;
}

export async function refreshIndices(indices) {
  const client = await getEsClient();
  if (!client) return;
  const idx = Array.isArray(indices) ? indices.join(',') : indices;
  try { await client.indices.refresh({ index: idx }); } catch { /* ignore */ }
}
