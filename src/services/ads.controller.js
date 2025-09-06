import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';

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
    const cacheKey = `ads:list:${JSON.stringify(req.query || {})}`;
    const cached = await getJson(cacheKey);
    if (cached) return res.json(cached);
    // Return all matching ads; if a 'limit' query param is provided, apply it, otherwise return full set
    const items = await prisma.advertisement.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    await setJson(cacheKey, items, 60);
    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const item = await prisma.advertisement.findUnique({ where: { id: Number(id) } });
  if (!item) return next(notFound());
  await setJson(`ads:detail:${id}`, item, 60);
  res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = req.body;
    const item = await prisma.advertisement.create({ data });
  await del('ads:list:{}');
  res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.advertisement.update({ where: { id: Number(id) }, data: req.body });
  await del('ads:list:{}');
  await del(`ads:detail:${id}`);
  res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.advertisement.delete({ where: { id: Number(id) } });
  await del('ads:list:{}');
  await del(`ads:detail:${id}`);
  res.status(204).end();
  } catch (err) { next(err); }
}
