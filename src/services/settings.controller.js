import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';

export async function list(_req, res, next) {
  try {
  const cacheKey = 'settings:list:{}';
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);
  const items = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  await setJson(cacheKey, items, 60);
  res.json(items);
  } catch (err) { next(err); }
}

export async function getByKey(req, res, next) {
  try {
    const { key } = req.params;
  const cacheKey = `settings:key:${key}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);
  const item = await prisma.setting.findUnique({ where: { key } });
  if (!item) return next(notFound());
    await setJson(cacheKey, item, 300);
    res.json(item);
  } catch (err) { next(err); }
}

export async function upsert(req, res, next) {
  try {
    const { key } = req.params;
    const { value, json } = req.body;
    const item = await prisma.setting.upsert({
      where: { key },
      update: { value, json },
      create: { key, value, json },
    });
  await del('settings:list:{}');
  await del(`settings:key:${key}`);
  res.json(item);
  } catch (err) { next(err); }
}
