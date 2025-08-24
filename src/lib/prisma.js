import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

// Create a single shared Prisma client instance and reuse it across the app.
// This avoids opening many connections when your app handles many requests.
const globalForPrisma = globalThis;

const clientOptions = {
	// Enable query logging in non-production to help with detecting slow queries.
	log: ['warn', 'error', 'query'],
};

export const prisma = globalForPrisma.prisma || new PrismaClient(clientOptions);

// In dev, keep a single instance across module reloads (hot reloads)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Optional: emit a console warning for slow queries (threshold in ms)
const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_QUERY_MS || 200);
try {
	prisma.$on('query', (e) => {
			if (e.duration > SLOW_QUERY_MS) {
				logger.warn(`Prisma slow query (${e.duration}ms): ${e.query} -- params: ${JSON.stringify(e.params)}`);
			}
	});
} catch (err) {
	// Some Prisma runtime builds may not support $on in older versions; ignore safely.
}
