import { prisma } from '../lib/prisma.js';
import { httpError, notFound, unauthorized } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';

export async function list(req, res, next) {
  try {
    const { jobId } = req.query;
    const where = { jobId: jobId ? Number(jobId) : undefined };
  const cacheKey = `reviews:list:${JSON.stringify(where)}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);
  const items = await prisma.jobReview.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } });
  await setJson(cacheKey, items, 60);
  res.json(items);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { jobId, rating, comment } = req.body ?? {};
    const userId = req.user?.id;
    if (!userId) return next(unauthorized());
    if (!rating || rating < 1 || rating > 5) return next(httpError(400, 'rating must be 1-5'));

    const job = await prisma.job.findUnique({ where: { id: Number(jobId) } });
    if (!job) return next(notFound());

    const created = await prisma.jobReview.create({ data: { jobId: Number(jobId), userId, rating, comment } });
    // invalidate reviews list cache for this job
    await del(`reviews:list:${JSON.stringify({ jobId: Number(jobId) })}`);
    res.status(201).json(created);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
  // find existing review to know jobId for cache invalidation
  const existing = await prisma.jobReview.findUnique({ where: { id: Number(id) }, select: { jobId: true } });
  const item = await prisma.jobReview.update({ where: { id: Number(id) }, data: req.body });
  if (existing?.jobId) await del(`reviews:list:${JSON.stringify({ jobId: existing.jobId })}`);
  res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
  const existing = await prisma.jobReview.findUnique({ where: { id: Number(id) }, select: { jobId: true } });
  await prisma.jobReview.delete({ where: { id: Number(id) } });
  if (existing?.jobId) await del(`reviews:list:${JSON.stringify({ jobId: existing.jobId })}`);
  res.status(204).end();
  } catch (err) { next(err); }
}
