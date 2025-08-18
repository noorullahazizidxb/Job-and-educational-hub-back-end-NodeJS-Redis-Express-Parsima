import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { q, role, page = 1, pageSize = 20 } = req.query;
    const where = {
      AND: [
        q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {},
        role ? { role } : {},
      ],
    };
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: 'desc' }, include: { company: true } }),
      prisma.user.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const item = await prisma.user.findUnique({ where: { id: Number(id) }, include: { company: true } });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = req.body;
    const item = await prisma.user.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.user.update({ where: { id: Number(id) }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err) { next(err); }
}
