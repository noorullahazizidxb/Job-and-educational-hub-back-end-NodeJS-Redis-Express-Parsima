import { prisma } from '../lib/prisma.js';

export async function applyToJob(req, res, next) {
  try {
    const files = req.files || {};
    const cv = files.cv?.[0];
    const cover = files.coverLetter?.[0];
    const body = req.body || {};
    // fields from multipart come as strings
    const data = {
      jobId: Number(body.jobId),
      userId: Number(body.userId),
      fullName: body.fullName,
      email: body.email,
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
    const { jobId, userId, status, page = 1, pageSize = 20 } = req.query;
    const where = {
      AND: [
        jobId ? { jobId: Number(jobId) } : {},
        userId ? { userId: Number(userId) } : {},
        status ? { status } : {},
      ],
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.jobApplication.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: 'desc' }, include: { job: true, user: true } }),
      prisma.jobApplication.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
}

export async function applyToService(req, res, next) {
  try {
    const files = req.files || {};
    const cv = files.cv?.[0];
    const cover = files.coverLetter?.[0];
    const body = req.body || {};
    const data = {
      serviceId: Number(body.serviceId),
      userId: Number(body.userId),
      fullName: body.fullName,
      email: body.email,
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
    const { serviceId, userId, status, page = 1, pageSize = 20 } = req.query;
    const where = {
      AND: [
        serviceId ? { serviceId: Number(serviceId) } : {},
        userId ? { userId: Number(userId) } : {},
        status ? { status } : {},
      ],
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.serviceApplication.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: 'desc' }, include: { service: true, user: true } }),
      prisma.serviceApplication.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
}
