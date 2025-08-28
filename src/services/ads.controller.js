import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { placement, activeOnly, limit } = req.query;
    const where = {};
    if (placement) where.placement = placement;
    if (activeOnly) {
      const now = new Date();
      where.isActive = true;
      where.OR = [
        { AND: [{ startAt: null }, { endAt: null }] },
        { AND: [{ startAt: { lte: now } }, { endAt: null }] },
        { AND: [{ startAt: null }, { endAt: { gte: now } }] },
        { AND: [{ startAt: { lte: now } }, { endAt: { gte: now } }] },
      ];
    }
    // Return all matching ads; if a 'limit' query param is provided, apply it, otherwise return full set
    const items = await prisma.advertisement.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const item = await prisma.advertisement.findUnique({ where: { id: Number(id) } });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = req.body;
    const item = await prisma.advertisement.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.advertisement.update({ where: { id: Number(id) }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.advertisement.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err) { next(err); }
}
