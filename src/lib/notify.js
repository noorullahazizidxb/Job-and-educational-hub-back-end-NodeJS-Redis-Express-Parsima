import { prisma } from './prisma.js';
import { notifyUserInbox, notifyCompanyInbox } from './ws.js';

// Create a notification directed to a single user and emit live update
export async function notifyUser({ title, body, link, userId, createdById }) {
  const notification = await prisma.notification.create({
    data: { title, body: body || null, link: link || null, createdById: createdById || null },
  });
  const rec = await prisma.notificationRecipient.create({ data: { notificationId: notification.id, userId: Number(userId) } });
  try { notifyUserInbox(Number(userId), { type: 'created', notificationId: notification.id }); } catch {}
  return { notification, recipient: rec };
}

// Create a notification directed to a single company and emit live update
export async function notifyCompany({ title, body, link, companyId, createdById }) {
  const notification = await prisma.notification.create({
    data: { title, body: body || null, link: link || null, createdById: createdById || null },
  });
  const rec = await prisma.notificationRecipient.create({ data: { notificationId: notification.id, companyId: Number(companyId) } });
  try { notifyCompanyInbox(Number(companyId), { type: 'created', notificationId: notification.id }); } catch {}
  return { notification, recipient: rec };
}

// Broadcast a notification to all users with a specific role (e.g., 'common', 'company') and emit live updates
export async function broadcastToRole({ title, body, link, targetRole, createdById }) {
  const notification = await prisma.notification.create({
    data: { title, body: body || null, link: link || null, targetRole, createdById: createdById || null },
  });
  const users = await prisma.user.findMany({ where: { role: targetRole }, select: { id: true } });
  if (users.length) {
    await prisma.notificationRecipient.createMany({ data: users.map(u => ({ notificationId: notification.id, userId: u.id })), skipDuplicates: true });
    // Emit per-user to their rooms
    for (const u of users) { try { notifyUserInbox(u.id, { type: 'created', notificationId: notification.id }); } catch {} }
  }
  return { notification, recipientCount: users.length };
}
