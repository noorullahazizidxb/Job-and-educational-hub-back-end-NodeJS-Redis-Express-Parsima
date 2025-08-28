import 'dotenv/config';
import express from 'express';
import path from 'path';
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
app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({limit:'10mb'}));
app.use(morgan('dev'));
app.use(authenticate);
app.use(responseEnvelope());
// static files for uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

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
