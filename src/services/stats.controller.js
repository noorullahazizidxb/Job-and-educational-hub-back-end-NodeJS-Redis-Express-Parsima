import { prisma } from '../lib/prisma.js';

// Returns active jobs count, companies count, average time-to-hire (ms) for hired applications
export async function overview(_req, res, next) {
  try {
    // Active jobs: status != 'closed' (published and draft are considered active here)
    const activeJobsP = prisma.job.count({ where: { status: { not: 'closed' } } });
    const companiesP = prisma.company.count();

    // For average time to hire, prefer computing in the DB via raw SQL for efficiency.
    // MySQL: TIMESTAMPDIFF(MICROSECOND, createdAt, updatedAt) gives microseconds; convert to ms.
    let avgMs = null;
    let hiredCount = 0;
    try {
      const result = await prisma.$queryRaw`
        SELECT
          COUNT(*) AS cnt,
          AVG(TIMESTAMPDIFF(MICROSECOND, createdAt, updatedAt)) / 1000 AS avg_ms
        FROM JobApplication
        WHERE status = 'hired' AND updatedAt > createdAt
      `;
      // Result shape depends on driver; normalize access
      if (Array.isArray(result) && result.length) {
        hiredCount = Number(result[0].cnt || result[0].CNT || result[0].count || 0);
        const rawAvg = result[0].avg_ms ?? result[0].AVG_MS ?? result[0].avg_ms;
        avgMs = rawAvg !== null && rawAvg !== undefined ? Number(rawAvg) : null;
      } else if (result && typeof result === 'object') {
        hiredCount = Number(result.cnt || result.CNT || result.count || 0);
        avgMs = result.avg_ms ? Number(result.avg_ms) : null;
      }
    } catch (e) {
      // If raw query failed (driver differences), fallback: fetch timestamps and compute in JS (safe but may be memory-heavy)
      const rows = await prisma.jobApplication.findMany({ where: { status: 'hired', updatedAt: { gt: new Date(0) } }, select: { createdAt: true, updatedAt: true } });
      hiredCount = rows.length;
      if (hiredCount) {
        const totalMs = rows.reduce((sum, r) => {
          const c = new Date(r.createdAt).getTime();
          const u = new Date(r.updatedAt).getTime();
          if (!isFinite(c) || !isFinite(u) || u <= c) return sum;
          return sum + (u - c);
        }, 0);
        avgMs = totalMs / hiredCount;
      }
    }

    const [activeJobs, companies] = await Promise.all([activeJobsP, companiesP]);

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
      hiredApplicationsCount: hiredCount,
      // averageTimeToHire contains the formatted representation according to rules:
      // < 1 hour => ms, < 24 hours => hours, >= 24 hours => days and hours
      averageTimeToHire: formatted,
    });
  } catch (err) {
    next(err);
  }
}
