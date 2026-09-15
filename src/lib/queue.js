import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { queueEnabled } from './runtime.js';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

let connection;

if (queueEnabled) {
  if (redisPassword) {
    const url = new URL(redisUrl);
    connection = new IORedis({
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: redisPassword,
      ...redisOptions,
    });
  } else {
    connection = new IORedis(redisUrl, redisOptions);
  }
}

const noopQueue = {
  add: async () => ({}),
  drain: async () => {},
  clean: async () => [],
  close: async () => {},
};

const noopWorker = {
  on() {},
  close: async () => {},
};

export function createQueue(name) {
  if (!queueEnabled) return noopQueue;
  return new Queue(name, { connection, prefix: process.env.QUEUE_PREFIX || 'job-portal' });
}

export function createWorker(name, processor, opts = {}) {
  if (!queueEnabled) return noopWorker;
  return new Worker(name, processor, { connection, prefix: process.env.QUEUE_PREFIX || 'job-portal', ...opts });
}
