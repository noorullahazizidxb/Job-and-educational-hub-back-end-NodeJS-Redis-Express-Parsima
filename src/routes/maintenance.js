import { Router } from 'express';
import { cleanupExpired, reindexAll } from '../services/maintenance.controller.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

function allowCronOrAdmin(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.get('authorization') || req.get('x-cron-secret') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (token && token === secret) return next();
  }
  return requireAdmin()(req, res, next);
}

router.post('/cleanup-expired', allowCronOrAdmin, cleanupExpired);
router.get('/cleanup-expired', allowCronOrAdmin, cleanupExpired);
router.post('/reindex-all', requireAdmin(), reindexAll);

export default router;
