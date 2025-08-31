import fs from 'fs';
import path from 'path';

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

export async function list(req, res, next) {
  try {
    const { q, type, status, cityId } = req.query;
    const where = {
      AND: [
        q ? { OR: [ { title: { contains: q } }, { description: { contains: q } }, { tags: { contains: q } } ] } : {},
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
    } catch (e) {}

    const items = await prisma.service.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      include: {
        company: true,
        city: true,
        applications: { include: { user: { select: { id: true, name: true, email: true, photo: true } } } },
      },
    });
    res.json(items);
  } catch (err) { next(err); }
}

export async function featured(req, res, next) {
  try {
    const now = new Date();
    const items = await prisma.service.findMany({
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
        applications: { include: { user: true } },
      },
    });
    res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { slug } = req.params;
  const item = await prisma.service.findUnique({
    where: { slug },
    include: {
      company: true,
      city: true,
  applications: { include: { user: true } },
    },
  });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const files = req.files || [];
    const body = req.body || {};
    const data = { ...body };
    if (files && files.length) {
      // store file paths under documents as array of URLs
      data.documents = files.map((f) => `/uploads/services/${f.filename}`);
    }
    const item = await prisma.service.create({ data });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { slug } = req.params;
    const files = req.files || [];
    const body = req.body || {};
    const data = { ...body };
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
    res.json(item);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { slug } = req.params;
    await prisma.service.delete({ where: { slug } });
    res.status(204).end();
  } catch (err) { next(err); }
}
