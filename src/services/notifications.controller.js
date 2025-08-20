import { prisma } from '../lib/prisma.js';
import { notFound, unauthorized, forbidden } from '../utils/httpError.js';

export async function list(req, res, next) {
  try {
    const { q, page = 1, pageSize = 20 } = req.query;
    const where = q ? { OR: [{ title: { contains: q } }, { body: { contains: q } }] } : {};
    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
    const item = await prisma.notification.findUnique({ where: { id: Number(id) }, include: { recipients: true } });
    if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { title, body, link, targetAll = false, targetRole, sendAt, recipientUserIds = [], recipientCompanyIds = [] } = req.body;
    const createdById = req.user?.id || null;

    const notification = await prisma.notification.create({
      data: {
        title, body, link, targetAll, targetRole: targetRole || null, sendAt: sendAt ? new Date(sendAt) : null, createdById,
        recipients: {
          create: [
            ...recipientUserIds.map((userId) => ({ userId: Number(userId) })),
            ...recipientCompanyIds.map((companyId) => ({ companyId: Number(companyId) })),
          ],
        },
      },
      include: { recipients: true },
    });
    res.status(201).json(notification);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { recipientUserIds, recipientCompanyIds, ...payload } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.notification.update({ where: { id: Number(id) }, data: payload });
      if (recipientUserIds || recipientCompanyIds) {
        await tx.notificationRecipient.deleteMany({ where: { notificationId: item.id } });
        const creates = [
          ...(recipientUserIds || []).map((userId) => ({ notificationId: item.id, userId: Number(userId) })),
          ...(recipientCompanyIds || []).map((companyId) => ({ notificationId: item.id, companyId: Number(companyId) })),
        ];
        if (creates.length) await tx.notificationRecipient.createMany({ data: creates });
      }
      return item;
    });

    res.json(updated);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.notification.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (err) { next(err); }
}

// Recipient APIs
export async function myInbox(req, res, next) {
  try {
    if (!req.user) return next(unauthorized());
    const userId = Number(req.user.id ?? req.user.sub);
    const companyId = req.user.companyId ? Number(req.user.companyId) : null;

    const where = {
      OR: [
        { userId },
        ...(companyId ? [{ companyId }] : []),
      ],
    };

    const items = await prisma.notificationRecipient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { notification: true },
    });
    res.json(items);
  } catch (err) { next(err); }
}

export async function markRead(req, res, next) {
  try {
    if (!req.user) return next(unauthorized());
    const { recipientId } = req.params;

    const rec = await prisma.notificationRecipient.findUnique({ where: { id: Number(recipientId) } });
    if (!rec) return next(notFound());

    // Ensure recipient belongs to current user/company
    const userId = Number(req.user.id ?? req.user.sub);
    const companyId = req.user.companyId ? Number(req.user.companyId) : null;
    const owns = (rec.userId && rec.userId === userId) || (rec.companyId && companyId && rec.companyId === companyId);
    if (!owns) return next(forbidden());

    const updated = await prisma.notificationRecipient.update({
      where: { id: rec.id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json(updated);
  } catch (err) { next(err); }
}
