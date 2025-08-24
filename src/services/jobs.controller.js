import { prisma } from '../lib/prisma.js';
import { httpError, notFound, unauthorized } from '../utils/httpError.js';

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
        q ? { OR: [ { title: { contains: q } }, { description: { contains: q } }, { skills: { contains: q } } ] } : {},
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

    const items = await prisma.job.findMany({ where, orderBy: { postedAt: 'desc' }, include: { company: true, city: true, categories: { include: { category: true } } } });

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
    const job = await prisma.job.create({
      data: {
        ...rest,
        skills: Array.isArray(skills) ? skills.join(',') : skills,
        categories: categoryIds?.length ? { createMany: { data: categoryIds.map((id) => ({ categoryId: Number(id) })) } } : undefined,
      },
      include: { categories: true },
    });
    res.status(201).json(job);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { slug } = req.params;
    const { categoryIds, ...payload } = req.body;
    const data = { ...payload };
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
    res.json(job);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { slug } = req.params;
    await prisma.job.delete({ where: { slug } });
    res.status(204).end();
  } catch (err) { next(err); }
}
