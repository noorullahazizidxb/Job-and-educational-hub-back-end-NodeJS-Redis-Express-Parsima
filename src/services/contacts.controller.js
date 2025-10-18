import { prisma } from '../lib/prisma.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { notFound, unauthorized } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { q } = req.query;
    const where = q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }, { message: { contains: q } }] } : {};
    const cacheKey = `contacts:list:${JSON.stringify(req.query || {})}`;
    const cached = await getJson(cacheKey);
    if (cached) return res.json(cached);
    const items = await prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' } });
    const payload = { items, suggestions: [] };
    await setJson(cacheKey, payload, 30);
    res.json(payload);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.contact.findUnique({ where: { id: Number(id) } });
    if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const body = req.body || {};
    const data = {
      firstName: body.firstName,
      lastName: body.lastName || null,
      email: body.email,
      phoneNumber: body.phoneNumber || null,
      message: body.message,
    };
    const item = await prisma.contact.create({ data });
    // invalidate contact list cache
    await del('contacts:list:{}');
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.contact.delete({ where: { id: Number(id) } });
    await del('contacts:list:{}');
    res.status(204).end();
  } catch (err) { next(err); }
}
