# Notifications

`src/routes/notifications.js` → `src/services/notifications.controller.js`. Schema: `src/validation/notifications.schema.js`. Realtime: `src/lib/ws.js` and `src/lib/notify.js`.

```mermaid
flowchart TD
  inbox[GET /me/inbox]
  read[POST /me/:recipientId/read and /me/read-all]
  admin[admin CRUD on /]
  inbox --> auth[requireAuth]
  read --> auth
  admin --> requireAdmin
  auth --> controller[NotificationsController]
  requireAdmin --> controller
  controller --> prisma[Notification and Recipient]
  controller --> socket[notifyUserInbox when Socket.IO is on]
```

On free Vercel, Socket.IO is off. The inbox still works over HTTP. Rooms on a VPS are `user:ID` and `company:ID`.
