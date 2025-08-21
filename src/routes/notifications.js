import { Router } from 'express';
import * as NotificationsController from '../services/notifications.controller.js';
import { validate } from '../utils/validate.js';
import { requireAdmin, requireRole } from '../middleware/authz.js';
import { requireAuth } from '../middleware/authn.js';
import { createNotificationSchema, updateNotificationSchema, listNotificationsSchema, markReadSchema, inboxQuerySchema } from '../validation/notifications.schema.js';

const router = Router();

// Recipient endpoints (authenticated users/companies): list my notifications and mark read
router.get('/me/inbox', requireAuth, validate(inboxQuerySchema, 'query'), NotificationsController.myInbox);
router.post('/me/:recipientId/read', requireAuth, validate(markReadSchema), NotificationsController.markRead);

// Admin: list and manage notifications
router.get('/', requireAdmin(), validate(listNotificationsSchema, 'query'), NotificationsController.list);
router.post('/', requireAdmin(), validate(createNotificationSchema), NotificationsController.create);
router.get('/:id', requireAdmin(), NotificationsController.detail);
router.patch('/:id', requireAdmin(), validate(updateNotificationSchema), NotificationsController.update);
router.delete('/:id', requireAdmin(), NotificationsController.remove);

export default router;
