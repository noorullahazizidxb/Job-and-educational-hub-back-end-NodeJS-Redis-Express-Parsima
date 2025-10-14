import { prisma } from '../lib/prisma.js';
import { httpError, notFound, unauthorized } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { isSearchEnabled, getEsClient } from '../lib/elasticsearch.js';
import { indexJobById, deleteFromIndex, INDEX } from '../lib/searchIndexer.js';

// List jobs by companyId
export async function listByCompany(req, res, next) {
  try {
    const { companyId } = req.params;
    const items = await prisma.job.findMany({
      where: { companyId: Number(companyId) },
      orderBy: { postedAt: 'desc' },
      include: { company: true, city: true, categories: { include: { category: true } } },
    });
    res.json(items);
  } catch (err) { next(err); }
}

export async function list(req, res, next) {
  try {
    const { q, location, type, status, cityId, categoryId, featured, withReviews, withReviewsCount } = req.query;
    const where = {
      AND: [
        // q handled via Elasticsearch when enabled; DB fallback below if ES disabled
        !q || !isSearchEnabled() ? (q ? { OR: [ { title: { contains: q } }, { description: { contains: q } }, { skills: { contains: q } } ] } : {}) : {},
        location ? { location: { contains: location } } : {},
        type ? { type } : {},
        status ? { status } : {},
        cityId ? { cityId: Number(cityId) } : {},
        featured != null ? { featured: featured === 'true' } : {},
  categoryId ? { categories: { some: { categoryId: Number(categoryId) } } } : {},
      ],
    };

    // Role-based access: if authenticated and role is NOT admin/common, restrict to user's companyId
    try {
      const role = req.user?.role;
      if (role && !['admin', 'common'].includes(role)) {
        const cid = req.user.companyId ? Number(req.user.companyId) : null;
        if (!cid) return res.json([]);
        where.AND.push({ companyId: cid });
      }
    } catch (e) {}

  const cacheKey = `jobs:list:${JSON.stringify(req.query || {})}`;
  const cached = await getJson(cacheKey);
  if (cached) {
    // Backwards compatibility: older cached value may be an array of items.
    if (Array.isArray(cached)) return res.json({ items: cached, suggestions: [] });
    return res.json(cached);
  }

  // If ES search enabled and q present, find IDs via ES first and filter DB by those IDs
  let esOrderedIds = null;
  let suggestions = [];
  if (q && isSearchEnabled()) {
    try {
      const client = await getEsClient();
      const resp = await client.search({
        index: 'jobs',
        size: 100,
        query: {
          multi_match: { query: q, fields: ['title^3', 'description', 'skills^2', 'location'] }
        }
      });
      const hits = resp?.hits?.hits || [];
      esOrderedIds = hits.map(h => Number(h._source?.id)).filter(Boolean);
      // suggestions: unique titles from top hits
      suggestions = [...new Set(hits.map(h => h._source?.title).filter(Boolean))].slice(0, 10);
      if (!esOrderedIds.length) {
        const payload = { items: [], suggestions };
        await setJson(cacheKey, payload, 10);
        return res.json(payload);
      }
      where.AND.push({ id: { in: esOrderedIds } });
    } catch (e) { /* fallback silently */ }
  }

  const items = await prisma.job.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      include: {
        company: true,
        city: true,
        categories: { include: { category: true } },
  applications: { include: { user: true } },
      },
    });

    // Preserve ES score ordering if applicable
    if (esOrderedIds && esOrderedIds.length) {
      const order = new Map(esOrderedIds.map((id, i) => [id, i]));
      items.sort((a, b) => (order.get(a.id) ?? 999999) - (order.get(b.id) ?? 999999));
    }

    // Always attach review aggregates (avgRating, reviewCount) for list view
    if (items.length) {
      const ids = items.map((j) => j.id);
      const grouped = await prisma.jobReview.groupBy({
        by: ['jobId'],
        _avg: { rating: true },
        _count: true,
        where: { jobId: { in: ids } },
      });
      const aggMap = new Map(grouped.map((g) => [g.jobId, { avgRating: g._avg.rating ?? 0, reviewCount: g._count }]));
      for (const job of items) {
        const agg = aggMap.get(job.id) || { avgRating: 0, reviewCount: 0 };
        job.avgRating = agg.avgRating;
        job.reviewCount = agg.reviewCount;
  // Add catagory (string) from the first related category name if present
  job.catagory = (job.categories?.[0]?.category?.name) || null;
      }

      // Attach latest N reviews per job (default 3). Use withReviewsCount=0 to disable.
      const count = withReviewsCount != null ? Number(withReviewsCount) : 3;
      if (count > 0) {
        const reviews = await prisma.jobReview.findMany({
          where: { jobId: { in: ids } },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        const byJob = new Map();
        for (const r of reviews) {
          if (!byJob.has(r.jobId)) byJob.set(r.jobId, []);
          const arr = byJob.get(r.jobId);
          if (arr.length < count) arr.push(r);
        }
        for (const job of items) {
          job.reviews = byJob.get(job.id) || [];
        }
      } else {
        for (const job of items) job.reviews = [];
      }
    }
  const payload = { items, suggestions };
  await setJson(cacheKey, payload, 30);
  res.json(payload);
  } catch (err) { next(err); }
}

export async function featured(req, res, next) {
  try {
    const { withReviewsCount } = req.query;
    const now = new Date();
    const items = await prisma.job.findMany({
      where: {
        featured: true,
        OR: [
          { featuredUntil: null },
          { featuredUntil: { gt: now } },
        ],
      },
      orderBy: { postedAt: 'desc' },
      include: {
        company: true,
        city: true,
        categories: { include: { category: true } },
        applications: { include: { user: true } },
      },
    });

    if (items.length) {
      const ids = items.map((j) => j.id);
      const grouped = await prisma.jobReview.groupBy({
        by: ['jobId'],
        _avg: { rating: true },
        _count: true,
        where: { jobId: { in: ids } },
      });
      const aggMap = new Map(grouped.map((g) => [g.jobId, { avgRating: g._avg.rating ?? 0, reviewCount: g._count }]));
      for (const job of items) {
        const agg = aggMap.get(job.id) || { avgRating: 0, reviewCount: 0 };
        job.avgRating = agg.avgRating;
        job.reviewCount = agg.reviewCount;
        job.catagory = (job.categories?.[0]?.category?.name) || null;
      }

      const count = withReviewsCount != null ? Number(withReviewsCount) : 3;
      if (count > 0) {
        const reviews = await prisma.jobReview.findMany({
          where: { jobId: { in: ids } },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        const byJob = new Map();
        for (const r of reviews) {
          if (!byJob.has(r.jobId)) byJob.set(r.jobId, []);
          const arr = byJob.get(r.jobId);
          if (arr.length < count) arr.push(r);
        }
        for (const job of items) job.reviews = byJob.get(job.id) || [];
      } else {
        for (const job of items) job.reviews = [];
      }
    }

    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { slug } = req.params;
  const job = await prisma.job.findUnique({
    where: { slug },
    include: {
      company: true,
      city: true,
      categories: { include: { category: true } },
  applications: { include: { user: true } },
    },
  });
  if (!job) return next(notFound());
  // Auto-increment views on detail access
  try {
    const updated = await prisma.job.update({ where: { slug }, data: { views: { increment: 1 } }, select: { views: true } });
    job.views = updated.views;
  } catch {}
  const agg = await prisma.jobReview.aggregate({ where: { jobId: job.id }, _avg: { rating: true }, _count: true });
  const reviews = await prisma.jobReview.findMany({
    where: { jobId: job.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ...job, reviews, avgRating: agg._avg.rating ?? 0, reviewCount: agg._count });
  } catch (err) { next(err); }
}

export async function addView(req, res, next) {
  try {
    const { slug } = req.params;
    const job = await prisma.job.update({ where: { slug }, data: { views: { increment: 1 } } });
    res.json({ views: job.views });
  } catch (err) { next(err); }
}

export async function listReviews(req, res, next) {
  try {
    const { slug } = req.params;
  const job = await prisma.job.findUnique({ where: { slug } });
  if (!job) return next(notFound());
    const reviews = await prisma.jobReview.findMany({ where: { jobId: job.id }, orderBy: { createdAt: 'desc' } });
    const { _avg, _count } = await prisma.jobReview.aggregate({ where: { jobId: job.id }, _avg: { rating: true }, _count: true });
    res.json({ items: reviews, avgRating: _avg.rating ?? 0, total: _count });
  } catch (err) { next(err); }
}

export async function createReview(req, res, next) {
  try {
    const { slug } = req.params;
    const { rating, comment } = req.body ?? {};
  const userId = req.user?.id;
  if (!userId) return next(unauthorized());
  if (!rating || rating < 1 || rating > 5) return next(httpError(400, 'rating must be 1-5'));
    const job = await prisma.job.findUnique({ where: { slug } });
  if (!job) return next(notFound());
    const created = await prisma.jobReview.create({
      data: { jobId: job.id, userId, rating, comment },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { categoryIds, skills, ...rest } = req.body;
    // Preserve DB defaults: if salaryMin/salaryMax are null or empty string, omit them so DB uses defaults
    const data = { ...rest };
    // If the property was not provided or is an empty string, omit it so DB default/behavior applies.
    // If it's explicitly null, keep null so Prisma will write NULL into the DB.
    if (!Object.prototype.hasOwnProperty.call(data, 'salaryMin') || data.salaryMin === '') {
      delete data.salaryMin;
    } else if (data.salaryMin === null) {
      // keep explicit null
    } else if (typeof data.salaryMin === 'string') {
      const n = Number(data.salaryMin);
      if (!Number.isNaN(n)) data.salaryMin = n;
    }
    if (!Object.prototype.hasOwnProperty.call(data, 'salaryMax') || data.salaryMax === '') {
      delete data.salaryMax;
    } else if (data.salaryMax === null) {
      // keep explicit null
    } else if (typeof data.salaryMax === 'string') {
      const n = Number(data.salaryMax);
      if (!Number.isNaN(n)) data.salaryMax = n;
    }
  // Normalize featuredUntil: convert empty string to null so DB default/null is used
  if (data.featuredUntil === '') data.featuredUntil = null;
    const job = await prisma.job.create({
      data: {
        ...data,
        skills: Array.isArray(skills) ? skills.join(',') : skills,
        categories: categoryIds?.length ? { createMany: { data: categoryIds.map((id) => ({ categoryId: Number(id) })) } } : undefined,
      },
      include: { categories: true },
    });
  // Invalidate job lists and company lists
  await del('jobs:list:{}');
  await del('companies:list:{}');
  try { await indexJobById(job.id); } catch {}
  res.status(201).json(job);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { slug } = req.params;
    const { categoryIds, ...payload } = req.body;
    const data = { ...payload };
    // If salaryMin/salaryMax are explicitly null or empty, remove them so DB default remains
    if (!Object.prototype.hasOwnProperty.call(data, 'salaryMin') || data.salaryMin === '') delete data.salaryMin;
    else if (data.salaryMin === null) {
      // keep explicit null
    } else if (typeof data.salaryMin === 'string') {
      const n = Number(data.salaryMin);
      if (!Number.isNaN(n)) data.salaryMin = n;
    }
    if (!Object.prototype.hasOwnProperty.call(data, 'salaryMax') || data.salaryMax === '') delete data.salaryMax;
    else if (data.salaryMax === null) {
      // keep explicit null
    } else if (typeof data.salaryMax === 'string') {
      const n = Number(data.salaryMax);
      if (!Number.isNaN(n)) data.salaryMax = n;
    }
  // Normalize featuredUntil: convert empty string to null before update
  if (data.featuredUntil === '') data.featuredUntil = null;
    if (data.skills && Array.isArray(data.skills)) data.skills = data.skills.join(',');
    const job = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({ where: { slug }, data });
      if (categoryIds) {
        await tx.jobCategory.deleteMany({ where: { jobId: updated.id } });
        if (categoryIds.length) {
          await tx.jobCategory.createMany({ data: categoryIds.map((id) => ({ jobId: updated.id, categoryId: Number(id) })) });
        }
      }
      return updated;
    });
  await del('jobs:list:{}');
  await del('companies:list:{}');
  try { await indexJobById(job.id); } catch {}
  res.json(job);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { slug } = req.params;
  // Fetch id first for ES deletion
  const existing = await prisma.job.findUnique({ where: { slug }, select: { id: true } });
  await prisma.job.delete({ where: { slug } });
  await del('jobs:list:{}');
  await del('companies:list:{}');
  try { if (existing) await deleteFromIndex(INDEX.jobs, existing.id); } catch {}
  res.status(204).end();
  } catch (err) { next(err); }
}
