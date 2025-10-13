#!/usr/bin/env node
import 'dotenv/config';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

// Optional elasticsearch client import guarded – only if URL provided
let { ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, ELASTICSEARCH_USERNAME, ELASTICSEARCH_PASSWORD } = process.env;

async function checkRedis() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const password = process.env.REDIS_PASSWORD || undefined;
  // Only use username when explicitly set in the environment. Avoid defaulting to prevent accidental ACL auth attempts.
  const username = typeof process.env.REDIS_USERNAME === 'string' && process.env.REDIS_USERNAME.length > 0 ? process.env.REDIS_USERNAME : undefined;

  const start = Date.now();
  let client;
  try {
    // Try auth modes in order to provide helpful diagnostic info:
    // 1) username+password (ACL-enabled Redis)
    // 2) password-only (older redis AUTH)
    // 3) URL-based connection
    const u = new URL(url);
    if (username && password) {
      client = new Redis({ host: u.hostname, port: Number(u.port) || 6379, username, password, maxRetriesPerRequest: 1 });
    } else if (password) {
      client = new Redis({ host: u.hostname, port: Number(u.port) || 6379, password, maxRetriesPerRequest: 1 });
    } else {
      client = new Redis(url, { maxRetriesPerRequest: 1 });
    }

    // Attach a short-lived error handler to prevent unhandled rejections from bubbling
    const onError = (e) => {
      // log minimal message; the await below will still surface the error for the try/catch
      // but this prevents Node from treating it as unhandled.
      // eslint-disable-next-line no-console
      console.debug('Redis client error event:', e && e.message ? e.message : e);
    };
    client.on('error', onError);

    await client.ping();
    const ms = Date.now() - start;
    console.log(`Redis: OK (${ms}ms)`);
    client.off('error', onError);
    await client.quit();
    return true;
  } catch (err) {
    console.error('Redis: FAIL -', err?.message || err);
    if (err && String(err).includes('WRONGPASS')) {
      console.error('Hint: WRONGPASS typically means the username/password pair is invalid or the user is disabled.');
      console.error(' - Check that REDIS_USERNAME and REDIS_PASSWORD in your .env match the Redis server ACL user credentials.');
      console.error(' - If your Redis is not ACL-enabled, unset REDIS_USERNAME in .env so the client uses password-only or URL-based auth.');
    }
    try { if (client) {
      try { client.off('error'); } catch (e) {}
      await client.quit();
    } } catch {}
    return false;
  }
}

async function checkMySQL() {
  const start = Date.now();
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    const ms = Date.now() - start;
    console.log(`MySQL (Prisma): OK (${ms}ms)`);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.error('MySQL (Prisma): FAIL -', err?.message || err);
    try { await prisma.$disconnect(); } catch {}
    return false;
  }
}

async function checkElastic() {
  if (!ELASTICSEARCH_URL) {
    console.log('Elasticsearch: SKIP (ELASTICSEARCH_URL not set)');
    return true; // not configured => treat as pass for CI convenience
  }
  const start = Date.now();
  try {
    // Dynamically import @elastic/elasticsearch only if needed to avoid a hard dependency
    const { Client } = await import('@elastic/elasticsearch');
    const auth = ELASTICSEARCH_API_KEY ? { apiKey: ELASTICSEARCH_API_KEY } : (ELASTICSEARCH_USERNAME || ELASTICSEARCH_PASSWORD ? { username: ELASTICSEARCH_USERNAME, password: ELASTICSEARCH_PASSWORD } : undefined);

    // First attempt: use provided URL with relaxed TLS for local testing
    try {
      const client = new Client({ node: ELASTICSEARCH_URL, auth, tls: { rejectUnauthorized: false } });
      const info = await client.info();
      const ms = Date.now() - start;
      console.log(`Elasticsearch: OK (${ms}ms) - ${info?.name || 'connected'}`);
      return true;
    } catch (firstErr) {
      // Try swapping protocol (http <-> https) which often helps diagnose TLS vs plain HTTP issues
      try {
        const parsed = new URL(ELASTICSEARCH_URL);
        parsed.protocol = parsed.protocol === 'https:' ? 'http:' : 'https:';
        const altNode = parsed.toString();
        const client2 = new Client({ node: altNode, auth, tls: { rejectUnauthorized: false } });
        const info2 = await client2.info();
        const ms2 = Date.now() - start;
        console.log(`Elasticsearch: OK (${ms2}ms) - ${info2?.name || 'connected'} (via ${parsed.protocol})`);
        return true;
      } catch (secondErr) {
        console.error('Elasticsearch: FAIL -', secondErr?.message || secondErr);
        console.error('Hints:');
        console.error(' - Ensure ELASTICSEARCH_URL points to your ES node (e.g. http://127.0.0.1:9200 or https://127.0.0.1:9200).');
        console.error(' - For Elasticsearch 8.x TLS is enabled by default; use https and set ELASTICSEARCH_USERNAME/ELASTICSEARCH_PASSWORD or ELASTICSEARCH_API_KEY in .env.');
        console.error(' - You can test with curl: curl -v <ELASTICSEARCH_URL>');
        return false;
      }
    }
  } catch (err) {
    console.error('Elasticsearch: FAIL -', err?.message || err);
    return false;
  }
}

(async function main() {
  const results = await Promise.all([checkRedis(), checkMySQL(), checkElastic()]);
  const ok = results.every(Boolean);
  process.exit(ok ? 0 : 2);
})();
