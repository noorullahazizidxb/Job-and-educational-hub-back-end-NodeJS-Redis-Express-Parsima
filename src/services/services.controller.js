import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { q, type, status, cityId, page = 1, pageSize = 20 } = req.query;
    const where = {
      AND: [
        q ? { OR: [ { title: { contains: q } }, { description: { contains: q } }, { tags: { contains: q } } ] } : {},
        type ? { type } : {},
        status ? { status } : {},
        cityId ? { cityId: Number(cityId) } : {},
      ],
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.service.findMany({ where, skip, take: Number(pageSize), orderBy: { postedAt: 'desc' }, include: { company: true, city: true } }),
      prisma.service.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { slug } = req.params;
  const item = await prisma.service.findUnique({ where: { slug }, include: { company: true, city: true } });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = req.body;
    const item = await prisma.service.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { slug } = req.params;
    const item = await prisma.service.update({ where: { slug }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { slug } = req.params;
    await prisma.service.delete({ where: { slug } });
    res.status(204).end();
  } catch (err) { next(err); }
}
