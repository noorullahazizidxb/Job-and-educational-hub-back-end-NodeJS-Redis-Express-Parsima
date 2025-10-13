import { prisma } from '../lib/prisma.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { notFound } from '../utils/httpError.js';
import { indexCompanyById, deleteFromIndex, INDEX } from '../lib/searchIndexer.js';
import { isSearchEnabled, getEsClient } from '../lib/elasticsearch.js';

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
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          _count: { select: { jobs: true, users: true } },
          city: true,
          jobs: { select: { id: true, title: true, slug: true, status: true, postedAt: true, vacancies: true, cityId: true } },
        },
      });
      return res.json(company ? [company] : []);
    }

    const { q, cityId } = req.query;
    const where = {
      AND: [
        !q || !isSearchEnabled() ? (q ? { OR: [{ name: { contains: q } }, { industry: { contains: q } }, { about: { contains: q } }, { description: { contains: q } }] } : {}) : {},
        cityId ? { cityId: Number(cityId) } : {},
      ],
    };
  const cacheKey = `companies:list:${JSON.stringify({ q, cityId })}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);

  let esOrderedIds = null;
  if (q && isSearchEnabled()) {
    try {
      const client = await getEsClient();
      const resp = await client.search({ index: 'companies', size: 100, query: { multi_match: { query: q, fields: ['name^3','industry','about','description'] } } });
      const ids = (resp?.hits?.hits || []).map(h => Number(h._source?.id)).filter(Boolean);
      if (!ids.length) { await setJson(cacheKey, [], 10); return res.json([]); }
      esOrderedIds = ids;
      where.AND.push({ id: { in: ids } });
    } catch { }
  }

  const items = await prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobs: true, users: true } },
        city: true,
        jobs: { select: { id: true, title: true, slug: true, status: true, postedAt: true, vacancies: true, cityId: true } },
      },
    });
  if (esOrderedIds) {
    const order = new Map(esOrderedIds.map((id, i) => [id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 999999) - (order.get(b.id) ?? 999999));
  }
  // cache short-lived (30s)
  await setJson(cacheKey, items, 30);
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
    // Invalidate companies list cache
    await del('companies:list:{}');
    try { await indexCompanyById(company.id); } catch {}
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
    await del('companies:list:{}');
    try { await indexCompanyById(company.id); } catch {}
    res.json(company);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
  const { id } = req.params;
  const byId = Number(id);
  const where = Number.isNaN(byId) ? { slug: id } : { id: byId };
  await prisma.company.delete({ where });
  await del('companies:list:{}');
  try {
    const idNum = Number(byId);
    if (!Number.isNaN(idNum)) await deleteFromIndex(INDEX.companies, idNum);
  } catch {}
  res.status(204).end();
  } catch (err) { next(err); }
}
