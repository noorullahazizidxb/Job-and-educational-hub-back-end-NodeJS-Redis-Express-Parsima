import { prisma } from '../lib/prisma.js';
import { getJson, setJson } from '../lib/cache.js';

// Returns active jobs count, companies count, average time-to-hire (ms) for hired applications
export async function overview(_req, res, next) {
  try {
  const cacheKey = 'stats:overview';
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);
    // Active jobs: status != 'closed' (published and draft are considered active here)
    const activeJobsP = prisma.job.count({ where: { status: { not: 'closed' } } });
    const companiesP = prisma.company.count();

    // Compute hired applications count reliably, and compute average time-to-hire via raw SQL for efficiency.
    let avgMs = null;
    // Use a direct count for hired applications to avoid driver-parsing issues
    const hiredCount = await prisma.jobApplication.count({ where: { status: 'hired' } }).catch(() => 0);
    try {
      // raw query returns driver-specific rows; alias columns to predictable names
      const raw = await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) AS cnt, AVG(TIMESTAMPDIFF(MICROSECOND, createdAt, updatedAt))/1000 AS avg_ms FROM JobApplication WHERE status = 'hired' AND updatedAt > createdAt"
      );
      let row = null;
      if (Array.isArray(raw) && raw.length) row = raw[0];
      else if (raw && typeof raw === 'object') row = raw;
      if (row) {
        // defensively locate avg value
        const candidates = Object.entries(row);
        for (const [k, v] of candidates) {
          const key = String(k).toLowerCase();
          if (key.includes('avg') || key.includes('avg_ms') || key.includes('timestampdiff')) {
            const n = Number(v);
            if (!Number.isNaN(n)) { avgMs = n; break; }
          }
        }
        // if avg not found but there's a numeric second column, try that
        if (avgMs === null && candidates.length >= 2) {
          const maybe = Number(candidates[1][1]);
          if (!Number.isNaN(maybe)) avgMs = maybe;
        }
      }
    } catch (e) {
      // fallback: compute in JS (safe but may be heavier)
      const rows = await prisma.jobApplication.findMany({ where: { status: 'hired' }, select: { createdAt: true, updatedAt: true } });
      if (rows.length) {
        const good = rows.filter(r => new Date(r.updatedAt).getTime() > new Date(r.createdAt).getTime());
        if (good.length) {
          const totalMs = good.reduce((sum, r) => sum + (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()), 0);
          avgMs = totalMs / good.length;
        }
      }
    }

    // Also count services by type (procurement, scholarship)
    const servicesCountP = prisma.service.groupBy({ by: ['type'], _count: { _all: true } }).catch(() => null);
    const jobApplicationsCountP = prisma.jobApplication.count().catch(() => 0);
    const serviceApplicationsCountP = prisma.serviceApplication.count().catch(() => 0);

    const [activeJobs, companies, servicesGrouped, jobApplications, serviceApplications] = await Promise.all([
      activeJobsP,
      companiesP,
      servicesCountP,
      jobApplicationsCountP,
      serviceApplicationsCountP,
    ]);

  const services = { procurement: 0, scholarship: 0 };
    if (Array.isArray(servicesGrouped)) {
      for (const row of servicesGrouped) {
        const t = String(row.type);
        const cnt = Number(row._count?._all ?? row._count ?? 0);
        if (t === 'procurement') services.procurement = cnt;
        else if (t === 'scholarship') services.scholarship = cnt;
      }
    }

    // Format average time according to rules:
    // - if < 1 hour => display ms
    // - if < 24 hours => display in hours (decimal)
    // - if >= 24 hours => display days and hours
    let formatted = null;
    if (avgMs !== null) {
      const ms = Math.round(avgMs);
      const oneHour = 1000 * 60 * 60;
      const oneDay = oneHour * 24;
      if (ms < oneHour) {
        formatted = `${ms} ms`;
      } else if (ms < oneDay) {
        const hours = ms / oneHour;
        formatted = `${Number(hours.toFixed(2))} hours`;
      } else {
        const days = Math.floor(ms / oneDay);
        const remainingMs = ms - days * oneDay;
        const hours = Math.floor(remainingMs / oneHour);
        formatted = `${days} days ${hours} hours`;
      }
    }

    res.json({
      activeJobs,
      companies,
      services,
      jobApplications,
      serviceApplications,
      hiredApplicationsCount: hiredCount,
      // averageTimeToHire contains the formatted representation according to rules:
      // < 1 hour => ms, < 24 hours => hours, >= 24 hours => days and hours
      averageTimeToHire: formatted,
    });
  try { await setJson(cacheKey, { activeJobs, companies, services, jobApplications, serviceApplications, hiredApplicationsCount: hiredCount, averageTimeToHire: formatted }, 60); } catch (e) { /* ignore cache errors */ }
  } catch (err) {
    next(err);
  }
}
