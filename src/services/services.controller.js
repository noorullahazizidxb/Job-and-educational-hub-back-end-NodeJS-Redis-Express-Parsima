import fs from 'fs';
import path from 'path';
import { getJson, setJson, del } from '../lib/cache.js';

// List services by companyId
export async function listByCompany(req, res, next) {
  try {
    const { companyId } = req.params;
    const items = await prisma.service.findMany({
      where: { companyId: Number(companyId) },
      orderBy: { postedAt: 'desc' },
      include: {
        company: true,
        city: true,
        applications: { include: { user: true } },
      },
    });
    res.json(items);
  } catch (err) { next(err); }
}
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';
import { indexServiceById, deleteFromIndex, INDEX } from '../lib/searchIndexer.js';
import { isSearchEnabled, getEsClient } from '../lib/elasticsearch.js';

export async function list(req, res, next) {
  try {
    const { q, type, status, cityId } = req.query;
    const where = {
      AND: [
        !q || !isSearchEnabled() ? (q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }, { tags: { contains: q } }] } : {}) : {},
        type ? { type } : {},
        status ? { status } : {},
        cityId ? { cityId: Number(cityId) } : {},
      ],
    };

    // Role-based access: non-admin/non-common users only see services for their company
    try {
      const role = req.user?.role;
      if (role && !['admin', 'common'].includes(role)) {
        const cid = req.user.companyId ? Number(req.user.companyId) : null;
        if (!cid) return res.json([]);
        where.AND.push({ companyId: cid });
      }
    } catch (e) { }

    const cacheKey = `services:list:${JSON.stringify(req.query || {})}`;
    const cached = await getJson(cacheKey);
    if (cached) return res.json(cached);

    let esOrderedIds = null;
    if (q && isSearchEnabled()) {
      try {
        const client = await getEsClient();
        const resp = await client.search({ index: 'services', size: 100, query: { multi_match: { query: q, fields: ['title^3','description','tags','organization'] } } });
        const ids = (resp?.hits?.hits || []).map(h => Number(h._source?.id)).filter(Boolean);
        if (!ids.length) { await setJson(cacheKey, [], 10); return res.json([]); }
        esOrderedIds = ids;
        where.AND.push({ id: { in: ids } });
      } catch {}
    }

    const items = await prisma.service.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      include: {
        company: true,
        city: true,
        applications: { include: { user: { select: { id: true, name: true, email: true, photo: true } } } },
      },
    });
    if (esOrderedIds) {
      const order = new Map(esOrderedIds.map((id, i) => [id, i]));
      items.sort((a, b) => (order.get(a.id) ?? 999999) - (order.get(b.id) ?? 999999));
    }
    await setJson(cacheKey, items, 30);
    res.json(items);
  } catch (err) { next(err); }
}

export async function featured(req, res, next) {
  try {
    const cacheKey = 'services:featured:{}';
    const cached = await getJson(cacheKey);
    if (cached) return res.json(cached);

    const items = await prisma.service.findMany({
      where: { featured: true },
      orderBy: { postedAt: 'desc' },
      include: {
        company: true,
        city: true,
        applications: { include: { user: true } },
      },
    });
    await setJson(cacheKey, items, 30);
    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { slug } = req.params;
    const cacheKey = `service:detail:${slug}`;
    const cached = await getJson(cacheKey);
    if (cached) return res.json(cached);

    const item = await prisma.service.findUnique({
      where: { slug },
      include: {
        company: true,
        city: true,
        applications: { include: { user: true } },
      },
    });
    if (!item) return next(notFound());
    await setJson(cacheKey, item, 60);
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const files = req.files || [];
    const body = req.body || {};
    // build data explicitly to avoid accidentally overwriting document files when body.documents is empty
    const data = {};
    // copy allowed non-file fields from body
    for (const k of Object.keys(body || {})) {
      if (k === 'documents') continue; // skip documents here; handled from uploaded files only
      data[k] = body[k];
    }
    if (files && files.length) {
      // store file paths under documents as array of URLs
      data.documents = files.map((f) => `/uploads/services/${f.filename}`);
    }
    const item = await prisma.service.create({ data });
    await del('services:list:{}');
    await del('services:featured:{}');
    try { await indexServiceById(item.id); } catch {}
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { slug } = req.params;
    const files = req.files || [];
    const body = req.body || {};
    // Build data explicitly and skip `documents` unless new files are provided.
    const data = {};
    for (const k of Object.keys(body || {})) {
      if (k === 'documents') continue; // documents handled from uploaded files only
      data[k] = body[k];
    }
    if (files && files.length) {
      // delete previous documents (if any)
      try {
        const prev = await prisma.service.findUnique({ where: { slug }, select: { documents: true } });
        if (prev?.documents && Array.isArray(prev.documents)) {
          for (const doc of prev.documents) {
            if (typeof doc === 'string' && doc.startsWith('/uploads/services/')) {
              const filePath = path.resolve(process.cwd(), doc.slice(1));
              try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
            }
          }
        }
      } catch (e) { /* ignore DB/read errors */ }

      data.documents = files.map((f) => `/uploads/services/${f.filename}`);
    }
    const item = await prisma.service.update({ where: { slug }, data });
    await del('services:list:{}');
    await del('services:featured:{}');
    await del(`service:detail:${slug}`);
    try { await indexServiceById(item.id); } catch {}
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { slug } = req.params;
      const existing = await prisma.service.findUnique({ where: { slug }, select: { id: true } });
      await prisma.service.delete({ where: { slug } });
    await del('services:list:{}');
    await del('services:featured:{}');
    await del(`service:detail:${slug}`);
      try { if (existing) await deleteFromIndex(INDEX.services, existing.id); } catch {}
    res.status(204).end();
  } catch (err) { next(err); }
}
