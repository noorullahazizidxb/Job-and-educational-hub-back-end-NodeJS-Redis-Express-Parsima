import { prisma } from '../lib/prisma.js';
import { getJson, setJson } from '../lib/cache.js';
import { getRedisSeries, buildLabels } from '../lib/metrics.js';
import { isPostgres, quoteIdent, sincePlaceholder } from '../lib/sqlDialect.js';

// Helper to get start timestamps
function sinceHours(hours) {
  const d = new Date();
  d.setHours(d.getHours() - hours, 0, 0, 0);
  return d;
}

function sinceDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfMonth(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); return x; }
function startOfYear(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return x; }
function startOfISOWeek(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7; // 1..7
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  x.setUTCHours(0,0,0,0);
  return x;
}

// Whitelisted table names to avoid SQL injection when building raw queries
const TABLES = {
  User: 'User',
  Job: 'Job',
  Service: 'Service',
  JobApplication: 'JobApplication',
  ServiceApplication: 'ServiceApplication',
};

// Group by DATE(createdAt) for a given model between since..now
function createdAtColumn() {
  return isPostgres() ? '"createdAt"' : 'createdAt';
}

function dayBucket() {
  return isPostgres() ? '("createdAt")::date' : 'DATE(createdAt)';
}

async function groupCountByDate(modelName, since) {
  const table = quoteIdent(TABLES[modelName] || '');
  if (!TABLES[modelName]) return [];
  const day = dayBucket();
  const sql = `SELECT ${day} AS d, COUNT(*) AS c FROM ${table} WHERE ${createdAtColumn()} >= ${sincePlaceholder()} GROUP BY ${day} ORDER BY d`;
  const rows = await prisma.$queryRawUnsafe(sql, since);
  return Array.isArray(rows)
    ? rows.map((r) => ({ date: String(Object.values(r)[0]), count: Number(Object.values(r)[1]) }))
    : [];
}

// Group counts by period label using MySQL functions
async function groupCountByPeriod(modelName, period, since) {
  if (!TABLES[modelName]) return [];
  const table = quoteIdent(TABLES[modelName]);
  const created = createdAtColumn();
  const ph = sincePlaceholder();
  let sql;
  if (isPostgres()) {
    if (period === 'daily') sql = `SELECT ${dayBucket()} AS b, COUNT(*) AS c FROM ${table} WHERE ${created} >= ${ph} GROUP BY 1 ORDER BY 1`;
    else if (period === 'weekly') sql = `SELECT to_char(${created}, 'IYYY') || '-W' || to_char(${created}, 'IW') AS b, COUNT(*) AS c FROM ${table} WHERE ${created} >= ${ph} GROUP BY 1 ORDER BY 1`;
    else if (period === 'monthly') sql = `SELECT to_char(${created}, 'YYYY-MM') AS b, COUNT(*) AS c FROM ${table} WHERE ${created} >= ${ph} GROUP BY 1 ORDER BY 1`;
    else if (period === 'yearly') sql = `SELECT to_char(${created}, 'YYYY') AS b, COUNT(*) AS c FROM ${table} WHERE ${created} >= ${ph} GROUP BY 1 ORDER BY 1`;
    else return [];
  } else if (period === 'daily') sql = `SELECT DATE(createdAt) AS b, COUNT(*) AS c FROM ${table} WHERE createdAt >= ? GROUP BY DATE(createdAt) ORDER BY b`;
  else if (period === 'weekly') sql = `SELECT CONCAT(YEAR(createdAt), '-W', LPAD(WEEK(createdAt, 3), 2, '0')) AS b, COUNT(*) AS c FROM ${table} WHERE createdAt >= ? GROUP BY YEAR(createdAt), WEEK(createdAt, 3) ORDER BY YEAR(createdAt), WEEK(createdAt, 3)`;
  else if (period === 'monthly') sql = `SELECT DATE_FORMAT(createdAt, '%Y-%m') AS b, COUNT(*) AS c FROM ${table} WHERE createdAt >= ? GROUP BY DATE_FORMAT(createdAt, '%Y-%m') ORDER BY b`;
  else if (period === 'yearly') sql = `SELECT CAST(YEAR(createdAt) AS CHAR) AS b, COUNT(*) AS c FROM ${table} WHERE createdAt >= ? GROUP BY YEAR(createdAt) ORDER BY YEAR(createdAt)`;
  else return [];
  const rows = await prisma.$queryRawUnsafe(sql, since).catch(() => []);
  return Array.isArray(rows) ? rows.map((r) => ({ bucket: String(r.b ?? r.B ?? Object.values(r)[0]), value: Number(r.c ?? Object.values(r)[1] ?? 0) })) : [];
}

export async function overview(_req, res, next) {
  try {
    const cacheKey = 'reports:overview:v2';
    const cached = await getJson(cacheKey);
    if (cached) return res.json(cached);

  const now = new Date();
  const dailySince = startOfDay(now);
  const weeklySince = startOfISOWeek(now);
  const monthlySince = startOfMonth(now);
  const yearlySince = startOfYear(now);

    // Counts per period by createdAt
    const counts = async (since) => {
      const [users, jobs, services, jobApplications] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.job.count({ where: { createdAt: { gte: since } } }),
        prisma.service.count({ where: { createdAt: { gte: since } } }),
        prisma.jobApplication.count({ where: { createdAt: { gte: since } } }),
      ]);

      // Distinct users who applied to jobs in this period (proxy for "visited users")
      const distinctSql = isPostgres()
        ? 'SELECT COUNT(DISTINCT "userId") AS cnt FROM "JobApplication" WHERE "createdAt" >= $1'
        : 'SELECT COUNT(DISTINCT userId) AS cnt FROM JobApplication WHERE createdAt >= ?';
      const distinctApplicantsRows = await prisma.$queryRawUnsafe(distinctSql, since).catch(() => [{ cnt: 0 }]);
      const visitedUsers = Number(
        Array.isArray(distinctApplicantsRows) && distinctApplicantsRows[0] && distinctApplicantsRows[0].cnt != null
          ? distinctApplicantsRows[0].cnt
          : 0,
      );

      return { users, jobs, services, jobApplications, visitedUsers };
    };

    const [daily, weekly, monthly, yearly, jobsAgg, topJobs, companiesCountM, serviceAppsCountM] = await Promise.all([
      counts(dailySince),
      counts(weeklySince),
      counts(monthlySince),
      counts(yearlySince),
      prisma.job.aggregate({ _sum: { views: true } }).catch(() => ({ _sum: { views: 0 } })),
      prisma.job
        .findMany({ orderBy: { views: 'desc' }, take: 10, select: { id: true, slug: true, title: true, views: true } })
        .catch(() => []),
      prisma.company.count({ where: { createdAt: { gte: monthlySince } } }).catch(() => 0),
      prisma.serviceApplication.count({ where: { createdAt: { gte: monthlySince } } }).catch(() => 0),
    ]);

    // Build simple timeseries for the last 30 days (daily buckets) for charts
    // Build per-period series for charts with fixed bucket counts and backfilling
    const last30dSince = sinceDays(30);
    const last12wSince = sinceDays(7 * 12);
    const last12mSince = sinceDays(31 * 12);
    const last5ySince = sinceDays(366 * 5);

    async function buildModelSeries(model, period, count, since) {
      const rows = await groupCountByPeriod(model, period, since);
      const labels = buildLabels(period, count, now);
      const map = new Map(rows.map((r) => [r.bucket, r.value]));
      return labels.map((b) => ({ bucket: b, value: Number(map.get(b) || 0) }));
    }

    const [
      usersDaily, jobsDaily, servicesDaily, jobAppsDaily, svcAppsDaily, companiesDaily,
      usersWeekly, jobsWeekly, servicesWeekly, jobAppsWeekly, svcAppsWeekly, companiesWeekly,
      usersMonthly, jobsMonthly, servicesMonthly, jobAppsMonthly, svcAppsMonthly, companiesMonthly,
      usersYearly, jobsYearly, servicesYearly, jobAppsYearly, svcAppsYearly, companiesYearly,
    ] = await Promise.all([
      buildModelSeries('User', 'daily', 30, last30dSince),
      buildModelSeries('Job', 'daily', 30, last30dSince),
      buildModelSeries('Service', 'daily', 30, last30dSince),
      buildModelSeries('JobApplication', 'daily', 30, last30dSince),
      buildModelSeries('ServiceApplication', 'daily', 30, last30dSince),
      buildModelSeries('Company', 'daily', 30, last30dSince),

      buildModelSeries('User', 'weekly', 12, last12wSince),
      buildModelSeries('Job', 'weekly', 12, last12wSince),
      buildModelSeries('Service', 'weekly', 12, last12wSince),
      buildModelSeries('JobApplication', 'weekly', 12, last12wSince),
      buildModelSeries('ServiceApplication', 'weekly', 12, last12wSince),
      buildModelSeries('Company', 'weekly', 12, last12wSince),

      buildModelSeries('User', 'monthly', 12, last12mSince),
      buildModelSeries('Job', 'monthly', 12, last12mSince),
      buildModelSeries('Service', 'monthly', 12, last12mSince),
      buildModelSeries('JobApplication', 'monthly', 12, last12mSince),
      buildModelSeries('ServiceApplication', 'monthly', 12, last12mSince),
      buildModelSeries('Company', 'monthly', 12, last12mSince),

      buildModelSeries('User', 'yearly', 5, last5ySince),
      buildModelSeries('Job', 'yearly', 5, last5ySince),
      buildModelSeries('Service', 'yearly', 5, last5ySince),
      buildModelSeries('JobApplication', 'yearly', 5, last5ySince),
      buildModelSeries('ServiceApplication', 'yearly', 5, last5ySince),
      buildModelSeries('Company', 'yearly', 5, last5ySince),
    ]);

    // Redis-based counters for viewers and logins: produce series for charts
    const [viewerDaily, viewerWeekly, viewerMonthly, viewerYearly, loginDaily, loginWeekly, loginMonthly, loginYearly] = await Promise.all([
      getRedisSeries('metrics:jobs:viewers', 'daily', 30),
      getRedisSeries('metrics:jobs:viewers', 'weekly', 12),
      getRedisSeries('metrics:jobs:viewers', 'monthly', 12),
      getRedisSeries('metrics:jobs:viewers', 'yearly', 5),
      getRedisSeries('metrics:auth:logins', 'daily', 30),
      getRedisSeries('metrics:auth:logins', 'weekly', 12),
      getRedisSeries('metrics:auth:logins', 'monthly', 12),
      getRedisSeries('metrics:auth:logins', 'yearly', 5),
    ]);

    const payload = {
      generatedAt: now.toISOString(),
      windows: {
        daily: { since: dailySince.toISOString(), until: now.toISOString() },
        weekly: { since: weeklySince.toISOString(), until: now.toISOString() },
        monthly: { since: monthlySince.toISOString(), until: now.toISOString() },
      },
      metrics: {
        daily,
        weekly,
        monthly,
        yearly,
        monthlyExtras: {
          companiesCreated: companiesCountM,
          serviceApplications: serviceAppsCountM,
        },
        jobsVisited: {
          totalViews: Number(jobsAgg?._sum?.views || 0),
          topViewedJobs: topJobs,
          note:
            'Jobs per-period view counts are not available because views are stored as a cumulative counter without timestamps.',
        },
        counters: {
          viewers: {
            daily: viewerDaily,
            weekly: viewerWeekly,
            monthly: viewerMonthly,
            yearly: viewerYearly,
          },
          logins: {
            daily: loginDaily,
            weekly: loginWeekly,
            monthly: loginMonthly,
            yearly: loginYearly,
          },
        },
      },
      timeseries: {
        daily: {
          users: usersDaily, jobs: jobsDaily, services: servicesDaily,
          jobApplications: jobAppsDaily, serviceApplications: svcAppsDaily, companies: companiesDaily,
        },
        weekly: {
          users: usersWeekly, jobs: jobsWeekly, services: servicesWeekly,
          jobApplications: jobAppsWeekly, serviceApplications: svcAppsWeekly, companies: companiesWeekly,
        },
        monthly: {
          users: usersMonthly, jobs: jobsMonthly, services: servicesMonthly,
          jobApplications: jobAppsMonthly, serviceApplications: svcAppsMonthly, companies: companiesMonthly,
        },
        yearly: {
          users: usersYearly, jobs: jobsYearly, services: servicesYearly,
          jobApplications: jobAppsYearly, serviceApplications: svcAppsYearly, companies: companiesYearly,
        },
      },
    };

    // cache for 60 seconds
    try { await setJson(cacheKey, payload, 60); } catch (e) {}
    res.json(payload);
  } catch (err) {
    next(err);
  }
}
