import { prisma } from '../lib/prisma.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

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
      cvUrl: cv ? `/uploads/${cv.filename}` : body.cvUrl,
      coverLetter: cover ? `/uploads/${cover.filename}` : body.coverLetter,
      answers: body.answers ? tryParseJSON(body.answers) : undefined,
    };
    const item = await prisma.jobApplication.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function listJobApplications(req, res, next) {
  try {
  const { jobId, userId, status } = req.query;
  const where = {
      AND: [
        jobId ? { jobId: Number(jobId) } : {},
        userId ? { userId: Number(userId) } : {},
        status ? { status } : {},
      ],
    };
  const items = await prisma.jobApplication.findMany({ where, orderBy: { createdAt: 'desc' }, include: { job: true, user: true } });
  res.json(items);
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
      cvUrl: cv ? `/uploads/${cv.filename}` : body.cvUrl,
      coverLetter: cover ? `/uploads/${cover.filename}` : body.coverLetter,
    };
    const item = await prisma.serviceApplication.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}

export async function listServiceApplications(req, res, next) {
  try {
  const { serviceId, userId, status } = req.query;
  const where = {
      AND: [
        serviceId ? { serviceId: Number(serviceId) } : {},
        userId ? { userId: Number(userId) } : {},
        status ? { status } : {},
      ],
    };
  const items = await prisma.serviceApplication.findMany({ where, orderBy: { createdAt: 'desc' }, include: { service: true, user: true } });
  res.json(items);
  } catch (err) { next(err); }
}
