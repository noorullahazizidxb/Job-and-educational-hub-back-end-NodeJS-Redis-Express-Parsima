import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function list(req, res, next) {
  try {
    // If the authenticated user is a company, only return their company
    const user = req.user;
    if (user && user.role === 'company') {
      const companyId = Number(user.companyId ?? user.sub ?? user.id);
      if (!companyId) return res.json([]);
      const company = await prisma.company.findUnique({ where: { id: companyId }, include: { _count: { select: { jobs: true, users: true } }, city: true } });
      return res.json(company ? [company] : []);
    }

    const { q, cityId } = req.query;
    const where = {
      AND: [
        q ? { OR: [{ name: { contains: q } }, { industry: { contains: q } }, { about: { contains: q } }, { description: { contains: q } }] } : {},
        cityId ? { cityId: Number(cityId) } : {},
      ],
    };
    const items = await prisma.company.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { jobs: true, users: true } }, city: true } });
    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
    const byId = Number(id);
    const where = Number.isNaN(byId) ? { slug: id } : { id: byId };
  const company = await prisma.company.findUnique({ where, include: { jobs: true, users: true, city: true } });
  if (!company) return next(notFound());
    res.json(company);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { name, website, logoUrl, industry, size, about, description, address, cityId } = req.body;
    const slug = req.body.slug?.trim() || toSlug(name);
    const company = await prisma.company.create({ data: { name, slug, website, logoUrl, industry, size, about, description, address, cityId } });
    res.status(201).json(company);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.name && !data.slug) data.slug = toSlug(data.name);
    const byId = Number(id);
    const where = Number.isNaN(byId) ? { slug: id } : { id: byId };
    const company = await prisma.company.update({ where, data });
    res.json(company);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
  const { id } = req.params;
  const byId = Number(id);
  const where = Number.isNaN(byId) ? { slug: id } : { id: byId };
  await prisma.company.delete({ where });
    res.status(204).end();
  } catch (err) { next(err); }
}
