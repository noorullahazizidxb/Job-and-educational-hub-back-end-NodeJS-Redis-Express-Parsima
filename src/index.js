import 'dotenv/config';
import express from 'express';
import path from 'path';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jobsRouter from './routes/jobs.js';
import companiesRouter from './routes/companies.js';
import servicesRouter from './routes/services.js';
import categoriesRouter from './routes/categories.js';
import citiesRouter from './routes/cities.js';
import adsRouter from './routes/ads.js';
import usersRouter from './routes/users.js';
import maintenanceRouter from './routes/maintenance.js';
import applicationsRouter from './routes/applications.js';
import settingsRouter from './routes/settings.js';
import { authenticate } from './middleware/authn.js';
import { prisma } from './lib/prisma.js';
import authRouter from './routes/auth.js';
import notificationsRouter from './routes/notifications.js';
import reviewsRouter from './routes/reviews.js';
import { responseEnvelope, getEntityFromRequest } from './middleware/response.js';

const app = express();

app.use(helmet());
// Allow images and other static resources to be loaded from other origins (e.g. frontend running on a different port)
// without being blocked by the Cross-Origin-Resource-Policy header.
app.use(
  helmet.crossOriginResourcePolicy({
    policy: 'cross-origin',
  }),
);
app.use(cors());
// enable gzip/brotli compression for responses
app.use(compression());

// tighten request body limits by default; allow overriding with env vars
const JSON_LIMIT = process.env.JSON_LIMIT || '100kb';
const URLENCODED_LIMIT = process.env.URLENCODED_LIMIT || '100kb';
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: URLENCODED_LIMIT }));
app.use(morgan('dev'));
app.use(authenticate);
app.use(responseEnvelope());
// static files for uploads - cache aggressively (served via CDN in prod is recommended)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '7d', etag: true }));

// Small caching middleware for common, read-heavy listing endpoints.
// This sets a short public cache for GET listing endpoints (adjust TTL as needed).
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const listingPrefixes = ['/api/jobs', '/api/services', '/api/categories', '/api/cities', '/api/companies', '/api/ads'];
  if (listingPrefixes.some((p) => req.path.startsWith(p))) {
    // short cache to reduce DB pressure; controllers should set more specific cache headers when safe
    res.setHeader('Cache-Control', 'public, max-age=60');
  }
  return next();
});

app.get('/health', async (_req, res) => {
  try {
    // lightweight DB check
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'ok' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});
app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/ads', adsRouter);
app.use('/api/users', usersRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/reviews', reviewsRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  // Normalize Joi validation errors to message only
  if (err && err.isJoi) {
    const message = err.message || 'Invalid request data';
    const entity = req?.entity || getEntityFromRequest(req) || 'unknown';
    const fullMsg = entity && entity !== 'unknown' ? `${entity} ${message}` : message;
    return res.status(400).json({ success: false, status: 400, entity, message: fullMsg });
  }
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const entity = req?.entity || getEntityFromRequest(req) || 'unknown';
  const fullMsg = entity && entity !== 'unknown' ? `${entity} ${message}` : message;
  res.status(status).json({ success: false, status, entity, message: fullMsg });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
