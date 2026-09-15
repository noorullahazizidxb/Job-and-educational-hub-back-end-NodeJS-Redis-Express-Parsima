import { prisma } from '../lib/prisma.js';
import { unauthorized, forbidden, notFound } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { indexJobApplicationById, indexServiceApplicationById } from '../lib/searchIndexer.js';
import { notifyCompany, notifyUser } from '../lib/notify.js';
import { publicFileUrl } from '../middleware/upload.js';

export async function applyToJob(req, res, next) {
  try {
    if (!req.user) return next(unauthorized());
    if ((req.user.role || '').toString() !== 'common') return next(forbidden('Only common users can apply'));
    const userId = Number(req.user.id ?? req.user.sub);
    const applicant = await prisma.user.findUnique({ where: { id: userId } });
    if (!applicant) return next(unauthorized());
    const files = req.files || {};
    const cv = files.cv?.[0];
    const cover = files.coverLetter?.[0];
    const body = req.body || {};
    // fields from multipart come as strings
    const data = {
      jobId: Number(body.jobId),
      userId: userId,
      fullName: applicant.name || applicant.email,
      email: applicant.email,
      answers: body.answers ? tryParseJSON(body.answers) : undefined,
    };
    // set cvUrl/coverLetter only when upload present or non-empty body value
    if (cv) data.cvUrl = publicFileUrl(cv, '/uploads');
    else if (body.cvUrl && String(body.cvUrl).trim()) data.cvUrl = body.cvUrl;
    if (cover) data.coverLetter = publicFileUrl(cover, '/uploads');
    else if (body.coverLetter && String(body.coverLetter).trim()) data.coverLetter = body.coverLetter;
  const item = await prisma.jobApplication.create({ data });
    // invalidate relevant caches
    await del('jobApplications:list:{}');
    await del('jobs:list:{}');
  try { await indexJobApplicationById(item.id); } catch {}
    // Notify company and applicant
    try {
      const job = await prisma.job.findUnique({ where: { id: data.jobId }, select: { id: true, title: true, companyId: true } });
      if (job?.companyId) {
        await notifyCompany({ title: 'New job application', body: `${applicant.name || applicant.email} applied to ${job.title}`, companyId: job.companyId, createdById: req.user?.id });
      }
      await notifyUser({ title: 'Application submitted', body: `Your application for ${job?.title || 'the job'} has been submitted.`, userId, createdById: req.user?.id });
    } catch {}
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function listJobApplications(req, res, next) {
  try {
    const { jobId, userId, status, q } = req.query;
    const where = {
      AND: [
        jobId ? { jobId: Number(jobId) } : {},
        userId ? { userId: Number(userId) } : {},
        status ? { status } : {},
        q ? { OR: [ { fullName: { contains: q } }, { email: { contains: q } } ] } : {},
      ],
    };
    const cacheKey = `jobApplications:list:${JSON.stringify(req.query || {})}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      if (Array.isArray(cached)) return res.json({ items: cached, suggestions: [] });
      return res.json(cached);
    }

  let suggestions = [];
  if (q && typeof q === 'string') {
      try {
        const { isSearchEnabled, getEsClient } = await import('../lib/elasticsearch.js');
        if (isSearchEnabled()) {
          const client = await getEsClient();
          const resp = await client.search({ index: 'applications', size: 50, query: { multi_match: { query: q, fields: ['fullName^3','email'] } } });
          const hits = resp?.hits?.hits || [];
          suggestions = [...new Set(hits.map(h => h._source?.fullName || h._source?.email).filter(Boolean))].slice(0, 10);
        }
      } catch (e) { /* ignore */ }
    }

    const items = await prisma.jobApplication.findMany({ where, orderBy: { createdAt: 'desc' }, include: { job: true, user: true } });
    const payload = { items, suggestions };
    await setJson(cacheKey, payload, 30);
    res.json(payload);
  } catch (err) { next(err); }
}

export async function applyToService(req, res, next) {
  try {
    if (!req.user) return next(unauthorized());
    if ((req.user.role || '').toString() !== 'common') return next(forbidden('Only common users can apply'));
    const userId = Number(req.user.id ?? req.user.sub);
    const applicant = await prisma.user.findUnique({ where: { id: userId } });
    if (!applicant) return next(unauthorized());
    const files = req.files || {};
    const cv = files.cv?.[0];
    const cover = files.coverLetter?.[0];
    const body = req.body || {};
    const data = {
      serviceId: Number(body.serviceId),
      userId: userId,
      fullName: applicant.name || applicant.email,
      email: applicant.email,
    };
    if (cv) data.cvUrl = publicFileUrl(cv, '/uploads');
    else if (body.cvUrl && String(body.cvUrl).trim()) data.cvUrl = body.cvUrl;
    if (cover) data.coverLetter = publicFileUrl(cover, '/uploads');
    else if (body.coverLetter && String(body.coverLetter).trim()) data.coverLetter = body.coverLetter;
  const item = await prisma.serviceApplication.create({ data });
    // invalidate relevant caches
    await del('serviceApplications:list:{}');
    await del('services:list:{}');
  try { await indexServiceApplicationById(item.id); } catch {}
    // Notify company (if any) and applicant
    try {
      const svc = await prisma.service.findUnique({ where: { id: data.serviceId }, select: { id: true, title: true, companyId: true } });
      if (svc?.companyId) {
        await notifyCompany({ title: 'New service application', body: `${applicant.name || applicant.email} applied to ${svc.title}`, companyId: svc.companyId, createdById: req.user?.id });
      }
      await notifyUser({ title: 'Application submitted', body: `Your application for ${svc?.title || 'the service'} has been submitted.`, userId, createdById: req.user?.id });
    } catch {}
    res.status(201).json(item);
  } catch (err) { next(err); }
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}

export async function listServiceApplications(req, res, next) {
  try {
    const { serviceId, userId, status, q } = req.query;
    const where = {
      AND: [
        serviceId ? { serviceId: Number(serviceId) } : {},
        userId ? { userId: Number(userId) } : {},
        status ? { status } : {},
        q ? { OR: [ { fullName: { contains: q } }, { email: { contains: q } } ] } : {},
      ],
    };
    const cacheKey = `serviceApplications:list:${JSON.stringify(req.query || {})}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      if (Array.isArray(cached)) return res.json({ items: cached, suggestions: [] });
      return res.json(cached);
    }

  let suggestions = [];
  if (q && typeof q === 'string') {
      try {
        const { isSearchEnabled, getEsClient } = await import('../lib/elasticsearch.js');
        if (isSearchEnabled()) {
          const client = await getEsClient();
          const resp = await client.search({ index: 'applications', size: 50, query: { multi_match: { query: q, fields: ['fullName^3','email'] } } });
          const hits = resp?.hits?.hits || [];
          suggestions = [...new Set(hits.map(h => h._source?.fullName || h._source?.email).filter(Boolean))].slice(0, 10);
        }
      } catch (e) { /* ignore */ }
    }

    const items = await prisma.serviceApplication.findMany({ where, orderBy: { createdAt: 'desc' }, include: { service: true, user: true } });
    const payload = { items, suggestions };
    await setJson(cacheKey, payload, 30);
    res.json(payload);
  } catch (err) { next(err); }
}

// Helper to create notification and recipient for a single user
async function createApplicationNotification({ title, body, createdById, userId }) {
  return prisma.notification.create({
    data: {
      title,
      body,
      createdById: createdById ? Number(createdById) : undefined,
      targetAll: false,
      targetRole: 'common',
      recipients: { create: [{ userId: Number(userId) }] },
    },
    include: { recipients: true },
  });
}

// Generic updater for job application status
async function _updateJobApplicationStatus(req, res, next, status) {
  try {
    if (!req.user) return next(unauthorized());
    const role = (req.user.role || '').toString();
    if (!['admin', 'company'].includes(role)) return next(forbidden());
    const id = Number(req.params.id);
    const app = await prisma.jobApplication.findUnique({ where: { id }, include: { job: true, user: true } });
    if (!app) return next(notFound());
    // company users can only operate on their own company's jobs
    if (role === 'company') {
      const cid = Number(req.user.companyId) || null;
      if (!cid || app.job.companyId !== cid) return next(forbidden());
    }
  const updated = await prisma.jobApplication.update({ where: { id }, data: { status }, include: { job: true, user: true } });
    const title = `updates on ${updated.job.title}`;
    const body = `your application for (${updated.job.title}) has been ${status}`;
    try { await notifyUser({ title, body, userId: updated.userId, createdById: req.user?.id }); } catch {}
    // invalidate caches that may list applications
    await del('jobApplications:list:{}');
    await del(`jobApplications:detail:${id}`);
  try { await indexJobApplicationById(id); } catch {}
    res.json(updated);
  } catch (err) { next(err); }
}

export async function markJobApplicationViewed(req, res, next) { return _updateJobApplicationStatus(req, res, next, 'viewed'); }
export async function markJobApplicationShortlisted(req, res, next) { return _updateJobApplicationStatus(req, res, next, 'shortlisted'); }
export async function markJobApplicationRejected(req, res, next) { return _updateJobApplicationStatus(req, res, next, 'rejected'); }
export async function markJobApplicationHired(req, res, next) { return _updateJobApplicationStatus(req, res, next, 'hired'); }
export async function markJobApplicationWithdrawn(req, res, next) { return _updateJobApplicationStatus(req, res, next, 'withdrawn'); }

// Generic updater for service application status
async function _updateServiceApplicationStatus(req, res, next, status) {
  try {
    if (!req.user) return next(unauthorized());
    const role = (req.user.role || '').toString();
    if (!['admin', 'company'].includes(role)) return next(forbidden());
    const id = Number(req.params.id);
    const app = await prisma.serviceApplication.findUnique({ where: { id }, include: { service: true, user: true } });
    if (!app) return next(notFound());
    if (role === 'company') {
      const cid = Number(req.user.companyId) || null;
      if (!cid || app.service.companyId !== cid) return next(forbidden());
    }
  const updated = await prisma.serviceApplication.update({ where: { id }, data: { status }, include: { service: true, user: true } });
    const title = `updates on ${updated.service.title}`;
    const body = `your application for (${updated.service.title}) has been ${status}`;
    try { await notifyUser({ title, body, userId: updated.userId, createdById: req.user?.id }); } catch {}
    // invalidate caches that may list service applications
    await del('serviceApplications:list:{}');
    await del(`serviceApplications:detail:${id}`);
  try { await indexServiceApplicationById(id); } catch {}
    res.json(updated);
  } catch (err) { next(err); }
}

export async function markServiceApplicationViewed(req, res, next) { return _updateServiceApplicationStatus(req, res, next, 'viewed'); }
export async function markServiceApplicationShortlisted(req, res, next) { return _updateServiceApplicationStatus(req, res, next, 'shortlisted'); }
export async function markServiceApplicationRejected(req, res, next) { return _updateServiceApplicationStatus(req, res, next, 'rejected'); }
export async function markServiceApplicationHired(req, res, next) { return _updateServiceApplicationStatus(req, res, next, 'hired'); }
export async function markServiceApplicationWithdrawn(req, res, next) { return _updateServiceApplicationStatus(req, res, next, 'withdrawn'); }
