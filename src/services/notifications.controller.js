import { prisma } from '../lib/prisma.js';
import { notFound, unauthorized, forbidden } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { notifyUserInbox, notifyCompanyInbox } from '../lib/ws.js';

export async function list(req, res, next) {
  try {
    const { q } = req.query;
    const where = q ? { OR: [{ title: { contains: q } }, { body: { contains: q } }] } : {};
  const cacheKey = `notifications:list:${JSON.stringify(req.query || {})}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);

  const rows = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: true,
        recipients: {
          include: {
            user: true,
            company: true,
          },
        },
      },
    });

    const items = rows.map((n) => ({
      ...n,
      // computed type for convenience: broadcast_all | role_<role> | direct
      type: n.targetAll ? 'broadcast_all' : (n.targetRole ? `role_${n.targetRole}` : 'direct'),
      recipients: (n.recipients || []).map((r) => ({
        ...r,
        type: r.userId ? 'user' : 'company',
        userName: r.user ? (r.user.name || null) : (r.company ? r.company.name : null),
        userEmail: r.user ? r.user.email : null,
      })),
    }));

  await setJson(cacheKey, items, 60);
  res.json(items);
  } catch (err) { next(err); }
}

export async function detail(req, res, next) {
  try {
    const { id } = req.params;
  const cacheKey = `notifications:detail:${id}`;
  const cached = await getJson(cacheKey);
  if (cached) return res.json(cached);

  const n = await prisma.notification.findUnique({
      where: { id: Number(id) },
      include: {
        createdBy: true,
        recipients: { include: { user: true, company: true } },
      },
    });
    if (!n) return next(notFound());
    const item = {
      ...n,
      type: n.targetAll ? 'broadcast_all' : (n.targetRole ? `role_${n.targetRole}` : 'direct'),
      recipients: (n.recipients || []).map((r) => ({
        ...r,
        type: r.userId ? 'user' : 'company',
        userName: r.user ? (r.user.name || null) : (r.company ? r.company.name : null),
        userEmail: r.user ? r.user.email : null,
      })),
    };
  await setJson(cacheKey, item, 120);
  res.json(item);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { title, body, link, targetAll = false, targetRole, sendAt, recipientUserIds = [], recipientCompanyIds = [] } = req.body;
    const createdById = req.user?.id || null;

    const result = await prisma.$transaction(async (tx) => {
      // 1) Create the notification
      const notification = await tx.notification.create({
        data: {
          title,
          body,
          link,
          targetAll,
          targetRole: targetRole || null,
          sendAt: sendAt ? new Date(sendAt) : null,
          createdById,
        },
      });

      // 2) Build audience: explicit recipients + targeted by role
      const audienceUserIds = new Set((recipientUserIds || []).map((x) => Number(x)));

      if (targetAll || targetRole) {
        const roles = targetAll ? ['common', 'company'] : [targetRole];
        const users = await tx.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
        for (const u of users) audienceUserIds.add(u.id);
      }

      const createRecipients = [
        ...Array.from(audienceUserIds).map((userId) => ({ notificationId: notification.id, userId })),
        ...(recipientCompanyIds || []).map((companyId) => ({ notificationId: notification.id, companyId: Number(companyId) })),
      ];
      if (createRecipients.length) {
        await tx.notificationRecipient.createMany({ data: createRecipients, skipDuplicates: true });
      }

      return tx.notification.findUnique({ where: { id: notification.id }, include: { recipients: true } });
    });
    try {
      // Push to rooms for each recipient
      for (const r of result.recipients || []) {
        if (r.userId) notifyUserInbox(r.userId, { type: 'created', notificationId: result.id });
        if (r.companyId) notifyCompanyInbox(r.companyId, { type: 'created', notificationId: result.id });
      }
    } catch {}
    res.status(201).json(result);
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
  // invalidate public notification caches
  await del('notifications:list:{}');
  await del(`notifications:detail:${id}`);
  try {
    // Send a generic update event; recipients might have changed
    // Emit to all roles/users interested: we only emit to explicit recipients after update
    const recs = await prisma.notificationRecipient.findMany({ where: { notificationId: Number(id) } });
    for (const r of recs) {
      if (r.userId) notifyUserInbox(r.userId, { type: 'updated', notificationId: Number(id) });
      if (r.companyId) notifyCompanyInbox(r.companyId, { type: 'updated', notificationId: Number(id) });
    }
  } catch {}
  res.json(updated);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.notification.delete({ where: { id: Number(id) } });
  await del('notifications:list:{}');
  await del(`notifications:detail:${id}`);
    try {
      const recs = await prisma.notificationRecipient.findMany({ where: { notificationId: Number(id) } });
      for (const r of recs) {
        if (r.userId) notifyUserInbox(r.userId, { type: 'deleted', notificationId: Number(id) });
        if (r.companyId) notifyCompanyInbox(r.companyId, { type: 'deleted', notificationId: Number(id) });
      }
    } catch {}
  res.status(204).end();
  } catch (err) { next(err); }
}

// Recipient APIs
export async function myInbox(req, res, next) {
  try {
    if (!req.user) return next(unauthorized());
    const userId = Number(req.user.id ?? req.user.sub);
    const companyId = req.user.companyId ? Number(req.user.companyId) : null;

    const { unreadOnly } = req.query;
    const where = {
      OR: [
        { userId },
        ...(companyId ? [{ companyId }] : []),
      ],
      ...(unreadOnly ? { isRead: false } : {}),
    };

  const rows = await prisma.notificationRecipient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        company: true,
        notification: { include: { createdBy: true } },
      },
    });

    const items = rows.map((r) => ({
      ...r,
      type: r.userId ? 'user' : 'company',
      userName: r.user ? (r.user.name || null) : (r.company ? r.company.name : null),
      userEmail: r.user ? r.user.email : null,
      notification: {
        ...r.notification,
        type: r.notification.targetAll ? 'broadcast_all' : (r.notification.targetRole ? `role_${r.notification.targetRole}` : 'direct'),
      },
    }));

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
  // invalidate public notifications list cache
  await del('notifications:list:{}');
  try {
    if (rec.userId) notifyUserInbox(rec.userId, { type: 'read', recipientId: rec.id });
    if (rec.companyId) notifyCompanyInbox(rec.companyId, { type: 'read', recipientId: rec.id });
  } catch {}
  res.json(updated);
  } catch (err) { next(err); }
}

export async function markAllRead(req, res, next) {
  try {
    if (!req.user) return next(unauthorized());
    const userId = Number(req.user.id ?? req.user.sub);

    // Mark all unread notification recipients belonging to this user as read
    const result = await prisma.notificationRecipient.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

  // invalidate public notifications list cache and return count
  await del('notifications:list:{}');
  try { notifyUserInbox(userId, { type: 'read-all' }); } catch {}
  res.json({ updated: result.count });
  } catch (err) { next(err); }
}
