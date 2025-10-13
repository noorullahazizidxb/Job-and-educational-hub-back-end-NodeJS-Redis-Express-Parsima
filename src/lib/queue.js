import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

// BullMQ requires ioredis option `maxRetriesPerRequest` to be null to support some commands.
// See: https://docs.bullmq.io/guide/configuration
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'; 
const redisPassword = process.env.REDIS_PASSWORD || undefined; 
const redisUsername = process.env.REDIS_USERNAME || 'noorullah';
const redisOptions = { 
  // required by BullMQ 
  maxRetriesPerRequest: null, 
  // keep ready check enabled by default; tune if using sentinel/cluster 
  enableReadyCheck: true, 
}; 
 
// Create a shared ioredis connection instance for queues/workers. 
// If REDIS_PASSWORD is provided, construct options with host/port/password. 
let connection; 
// If either username or password is provided, construct options with host/port/creds. 
if (redisPassword || redisUsername) { 
  const url = new URL(redisUrl); 
  connection = new IORedis({ 
    host: url.hostname, 
    port: Number(url.port) || 6379, 
    username: redisUsername,
    password: redisPassword, 
    ...redisOptions, 
  }); 
} else { 
  connection = new IORedis(redisUrl, redisOptions); 
} 

export function createQueue(name) {
  return new Queue(name, { connection, prefix: process.env.QUEUE_PREFIX || 'job-portal' });
}

export function createWorker(name, processor, opts = {}) {
  return new Worker(name, processor, { connection, prefix: process.env.QUEUE_PREFIX || 'job-portal', ...opts });
}
