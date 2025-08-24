import { prisma } from '../lib/prisma.js';
import { httpError, notFound, unauthorized } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { jobId } = req.query;
    const where = { jobId: jobId ? Number(jobId) : undefined };
    const items = await prisma.jobReview.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } });
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
