import { prisma } from '../lib/prisma.js';

// DELETE expired jobs and services and their dependent records.
// Query params:
// - before: ISO date string; defaults to now
// - dryRun: boolean; when true, only returns what would be deleted
// - limit: number; optional max number of jobs/services to process
export async function cleanupExpired(req, res, next) {
  try {
    const before = req.query.before ? new Date(req.query.before) : new Date();
    if (Number.isNaN(before.getTime())) return res.status(400).json({ success: false, status: 400, entity: 'maintenance', message: 'Invalid before date' });
    const dryRun = toBool(req.query.dryRun);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    // Find expired jobs/services first
    const [expiredJobs, expiredServices] = await Promise.all([
      prisma.job.findMany({
        where: { closingDate: { lte: before } },
        select: { id: true, slug: true, closingDate: true },
        take: limit,
        orderBy: { id: 'asc' },
      }),
      prisma.service.findMany({
        where: { closingDate: { lte: before } },
        select: { id: true, slug: true, closingDate: true },
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    const jobIds = expiredJobs.map((j) => j.id);
    const serviceIds = expiredServices.map((s) => s.id);

    if (dryRun) {
      return res.json({
        before,
        dryRun: true,
        jobs: { count: jobIds.length, ids: jobIds },
        services: { count: serviceIds.length, ids: serviceIds },
      });
    }

    // Delete dependents then main records in a transaction
    const results = await prisma.$transaction(async (tx) => {
      let deleted = { jobApplications: 0, jobReviews: 0, jobCategories: 0, jobs: 0, serviceApplications: 0, services: 0 };

      if (jobIds.length) {
        const da = await tx.jobApplication.deleteMany({ where: { jobId: { in: jobIds } } });
        const dr = await tx.jobReview.deleteMany({ where: { jobId: { in: jobIds } } });
        const djc = await tx.jobCategory.deleteMany({ where: { jobId: { in: jobIds } } });
        const dj = await tx.job.deleteMany({ where: { id: { in: jobIds } } });
        deleted.jobApplications += da.count;
        deleted.jobReviews += dr.count;
        deleted.jobCategories += djc.count;
        deleted.jobs += dj.count;
      }

      if (serviceIds.length) {
        const dsa = await tx.serviceApplication.deleteMany({ where: { serviceId: { in: serviceIds } } });
        const ds = await tx.service.deleteMany({ where: { id: { in: serviceIds } } });
        deleted.serviceApplications += dsa.count;
        deleted.services += ds.count;
      }

      return deleted;
    });

    res.json({ before, dryRun: false, deleted: results });
  } catch (err) {
    next(err);
  }
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
  return false;
}
