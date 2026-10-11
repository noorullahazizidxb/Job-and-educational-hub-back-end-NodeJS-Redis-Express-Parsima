import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import logger from '../utils/logger.js';

function databaseProvider() {
	return String(process.env.DB_PROVIDER || 'mysql').toLowerCase();
}

/**
 * Prisma 7 does not read a URL from the schema. Migrate uses prisma.config.ts.
 * Queries use the driver adapter for the active DB_PROVIDER.
 */
export function createPrismaAdapter() {
	const provider = databaseProvider();
	if (provider === 'turso') {
		const url = process.env.TURSO_DATABASE_URL;
		if (!url) {
			throw new Error('TURSO_DATABASE_URL is required when DB_PROVIDER is turso');
		}
		return new PrismaLibSql({
			url,
			authToken: process.env.TURSO_AUTH_TOKEN,
		});
	}

	if (provider === 'sqlite') {
		return new PrismaBetterSqlite3({
			url: process.env.SQLITE_URL || 'file:./dev.db',
		});
	}

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error(`DATABASE_URL is required when DB_PROVIDER is ${provider}`);
	}

	if (provider === 'postgresql' || provider === 'postgres') {
		return new PrismaPg({
			connectionString,
			max: process.env.VERCEL ? 1 : 10,
		});
	}

	return new PrismaMariaDb(connectionString);
}

const globalForPrisma = globalThis;

const clientOptions = {
	adapter: createPrismaAdapter(),
	log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error', 'query'],
};

export const prisma = globalForPrisma.prisma || new PrismaClient(clientOptions);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_QUERY_MS || 200);
if (process.env.NODE_ENV !== 'production') {
	try {
		prisma.$on('query', (e) => {
			if (e.duration > SLOW_QUERY_MS) {
				logger.warn(`Prisma slow query (${e.duration}ms): ${e.query} -- params: ${JSON.stringify(e.params)}`);
			}
		});
	} catch {
		// Query events are optional when the driver adapter does not emit them.
	}
}
