import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';

export async function list(_req, res, next) {
  try {
  const cacheKey = 'categories:list:{}';
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);
  const items = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  await setJson(cacheKey, items, 60);
  res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const item = await prisma.category.findUnique({ where: { id: Number(id) } });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const item = await prisma.category.create({ data: req.body });
  await del('categories:list:{}');
  res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.category.update({ where: { id: Number(id) }, data: req.body });
  await del('categories:list:{}');
  res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id: Number(id) } });
  await del('categories:list:{}');
  res.status(204).end();
  } catch (err) { next(err); }
}
