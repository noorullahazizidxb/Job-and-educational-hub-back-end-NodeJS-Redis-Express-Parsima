import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

export async function list(_req, res, next) {
  try {
    const items = await prisma.city.findMany({ orderBy: { name: 'asc' } });
    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const item = await prisma.city.findUnique({ where: { id: Number(id) } });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const item = await prisma.city.create({ data: req.body });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.city.update({ where: { id: Number(id) }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.city.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err) { next(err); }
}
