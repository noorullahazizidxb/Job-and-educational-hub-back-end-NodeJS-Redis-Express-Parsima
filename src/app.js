import 'dotenv/config';
import express from 'express';
import path from 'path';
import os from 'os';
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
import statsRouter from './routes/stats.js';
import reportsRouter from './routes/reports.js';
import contactsRouter from './routes/contacts.js';
import './lib/redis.js';
import rateLimitMiddleware from './middleware/rateLimit.js';
import { responseEnvelope, getEntityFromRequest } from './middleware/response.js';
import { getIO } from './lib/ws.js';
import { corsOrigins, isVercel, runtimeSummary } from './lib/runtime.js';

const app = express();

if (isVercel) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  helmet.crossOriginResourcePolicy({
    policy: 'cross-origin',
  }),
);
app.use(cors({ origin: corsOrigins(), credentials: true }));
app.use(compression());

const JSON_LIMIT = process.env.JSON_LIMIT || '100kb';
const URLENCODED_LIMIT = process.env.URLENCODED_LIMIT || '100kb';
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: URLENCODED_LIMIT }));
app.use(morgan('dev'));
app.use(authenticate);
app.use(rateLimitMiddleware);
app.use(responseEnvelope());

const uploadsRoot = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsRoot, { maxAge: '7d', etag: true }));

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const listingPrefixes = ['/api/jobs', '/api/services', '/api/categories', '/api/cities', '/api/companies', '/api/ads'];
  if (listingPrefixes.some((p) => req.path.startsWith(p))) {
    res.setHeader('Cache-Control', 'public, max-age=60');
  }
  return next();
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'ok', runtime: runtimeSummary() });
  } catch {
    res.status(503).json({ ok: false, db: 'down', runtime: runtimeSummary() });
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
app.use('/api/stats', statsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/contacts', contactsRouter);

function wsSubscribeHint(req, _res, next) {
  try {
    getIO();
    _res.setHeader('X-WS-Subscribe-Inbox', '1');
  } catch { /* ignore */ }
  return next();
}
app.use(['/api/jobs', '/api/services', '/api/companies', '/api/stats/overview'], wsSubscribeHint);

app.use((err, req, res, _next) => {
  console.error(err);
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

export default app;
export { app };
