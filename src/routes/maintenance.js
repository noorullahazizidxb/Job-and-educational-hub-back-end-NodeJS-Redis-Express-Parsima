import { Router } from 'express';
import { cleanupExpired, reindexAll } from '../services/maintenance.controller.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

// Admin-only endpoint to cleanup expired jobs and services
router.post('/cleanup-expired', requireAdmin(), cleanupExpired);
router.post('/reindex-all', requireAdmin(), reindexAll);

export default router;
