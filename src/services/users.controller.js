import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { notFound, forbidden, unauthorized } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { enqueueProfileOptimization } from '../middleware/upload.js';

export async function list(req, res, next) {
  try {
  const { q, role } = req.query;
  const where = {
      AND: [
        q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {},
        role ? { role } : {},
      ],
    };
  const cacheKey = `users:list:${JSON.stringify(req.query || {})}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);

  const items = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
      photo: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

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

  await setJson(cacheKey, items, 30);
  res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const userId = Number(id);
  const cacheKey = `users:detail:${userId}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);
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
    // for common users include applications but avoid caching these personalized details
    if (item.role === 'common') {
      const [jobApplications, serviceApplications] = await Promise.all([
        prisma.jobApplication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { job: true } }),
        prisma.serviceApplication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { service: true } }),
      ]);
      item.jobApplications = jobApplications;
      item.serviceApplications = serviceApplications;
      res.json(item);
    } else {
      await setJson(cacheKey, item, 60);
      res.json(item);
    }
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const body = req.body || {};
    const files = req.files || {};
    const photoFile = req.file || files.photo?.[0];

    // Default role to 'common' when not provided
    const role = body.role || 'common';

    // If creating a non-common user, require that the requester is authenticated and an admin
    if (role !== 'common') {
      if (!req.user) return next(unauthorized('Authentication required to create this user role'));
      if (req.user.role !== 'admin') return next(forbidden('Only admins can create users with this role'));
    }

    const payload = {
      email: body.email,
      name: body.name || null,
      role,
      companyId: body.companyId ? Number(body.companyId) : null,
      about: body.about || null,
      skills: body.skills || null,
      phone: body.phone || null,
      address: body.address || null,
  };

  if (photoFile) payload.photo = `/uploads/profile/${photoFile.filename}`;

  // handle password hashing
    if (body.password) {
      payload.passwordHash = await bcrypt.hash(body.password, 10);
    } else if (body.passwordHash) {
      payload.passwordHash = body.passwordHash;
    }

  const item = await prisma.user.create({ data: payload });
  // enqueue optimization job for profile photo (non-blocking)
  if (photoFile) {
    try { enqueueProfileOptimization(req, photoFile); } catch (e) { /* ignore */ }
  }
  await del('users:list:{}');
  res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const files = req.files || {};
    const photoFile = req.file || files.photo?.[0];

    const payload = {
      email: body.email,
      name: body.name,
      role: body.role,
      companyId: body.companyId ? Number(body.companyId) : null,
      about: body.about ?? null,
  // Accept skills as either an array or a comma-separated string. Store as CSV string.
  skills: Array.isArray(body.skills) ? body.skills.join(',') : (body.skills ?? null),
      phone: body.phone ?? null,
      address: body.address ?? null,
    };

    if (photoFile) {
      // delete previous profile photo file if present
      try {
        const prev = await prisma.user.findUnique({ where: { id: Number(id) }, select: { photo: true } });
        if (prev?.photo && typeof prev.photo === 'string' && prev.photo.startsWith('/uploads/profile/')) {
          const filePath = path.resolve(process.cwd(), prev.photo.slice(1));
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore deletion errors */ }
        }
      } catch (e) { /* ignore DB/read errors here; update will proceed */ }
      payload.photo = `/uploads/profile/${photoFile.filename}`;
    }

    // handle password hashing on update
    if (body.password) {
      payload.passwordHash = await bcrypt.hash(body.password, 10);
    } else if (body.passwordHash) {
      payload.passwordHash = body.passwordHash;
    }

  const item = await prisma.user.update({ where: { id: Number(id) }, data: payload });
  if (photoFile) {
    try { enqueueProfileOptimization(req, photoFile); } catch (e) { /* ignore */ }
  }
  await del('users:list:{}');
  await del(`users:detail:${id}`);
  res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    // delete profile photo from disk if present
    try {
      const prev = await prisma.user.findUnique({ where: { id: Number(id) }, select: { photo: true } });
      if (prev?.photo && typeof prev.photo === 'string' && prev.photo.startsWith('/uploads/profile/')) {
        const filePath = path.resolve(process.cwd(), prev.photo.slice(1));
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

  await prisma.user.delete({ where: { id: Number(id) } });
  await del('users:list:{}');
  await del(`users:detail:${id}`);
  res.status(204).end();
  } catch (err) { next(err); }
}
