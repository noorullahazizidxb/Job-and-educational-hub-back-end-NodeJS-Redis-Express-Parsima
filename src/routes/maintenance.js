import { Router } from 'express';
import { cleanupExpired } from '../services/maintenance.controller.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

// Admin-only endpoint to cleanup expired jobs and services
router.post('/cleanup-expired', requireAdmin(), cleanupExpired);

export default router;
