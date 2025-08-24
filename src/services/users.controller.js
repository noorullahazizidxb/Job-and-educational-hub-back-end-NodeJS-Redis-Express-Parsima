import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
  const { q, role } = req.query;
  const where = {
      AND: [
        q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {},
        role ? { role } : {},
      ],
    };
  const items = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, include: { company: true } });

    // For users with role 'common', include their job and service applications
    const commonIds = items.filter((u) => u.role === 'common').map((u) => u.id);
    if (commonIds.length) {
      const [jobApps, serviceApps] = await Promise.all([
        prisma.jobApplication.findMany({
          where: { userId: { in: commonIds } },
          orderBy: { createdAt: 'desc' },
          include: { job: true },
        }),
        prisma.serviceApplication.findMany({
          where: { userId: { in: commonIds } },
          orderBy: { createdAt: 'desc' },
          include: { service: true },
        }),
      ]);
      const jaByUser = new Map();
      for (const a of jobApps) {
        const arr = jaByUser.get(a.userId) || [];
        arr.push(a);
        jaByUser.set(a.userId, arr);
      }
      const saByUser = new Map();
      for (const a of serviceApps) {
        const arr = saByUser.get(a.userId) || [];
        arr.push(a);
        saByUser.set(a.userId, arr);
      }
      for (const u of items) {
        if (u.role === 'common') {
          u.jobApplications = jaByUser.get(u.id) || [];
          u.serviceApplications = saByUser.get(u.id) || [];
        }
      }
    }

  res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
    const userId = Number(id);
    const item = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
    if (!item) return next(notFound());

    if (item.role === 'common') {
      const [jobApplications, serviceApplications] = await Promise.all([
        prisma.jobApplication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { job: true } }),
        prisma.serviceApplication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { service: true } }),
      ]);
      item.jobApplications = jobApplications;
      item.serviceApplications = serviceApplications;
    }
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = req.body;
    const item = await prisma.user.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.user.update({ where: { id: Number(id) }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err) { next(err); }
}
