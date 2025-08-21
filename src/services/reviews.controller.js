import { prisma } from '../lib/prisma.js';
import { httpError, notFound, unauthorized } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { jobId, page = 1, pageSize = 20 } = req.query;
    const where = { jobId: jobId ? Number(jobId) : undefined };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.jobReview.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } }),
      prisma.jobReview.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
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
    res.status(201).json(created);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.jobReview.update({ where: { id: Number(id) }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.jobReview.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err) { next(err); }
}
