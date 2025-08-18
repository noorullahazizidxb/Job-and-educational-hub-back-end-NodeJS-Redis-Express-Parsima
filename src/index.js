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
import applicationsRouter from './routes/applications.js';
import settingsRouter from './routes/settings.js';
import { authenticate } from './middleware/authn.js';
import authRouter from './routes/auth.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(authenticate);
// static files for uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/ads', adsRouter);
app.use('/api/users', usersRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/settings', settingsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  // Normalize Joi validation errors to message only
  if (err && err.isJoi) {
    const message = err.message || 'Invalid request data';
    return res.status(400).json({ message });
  }
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
