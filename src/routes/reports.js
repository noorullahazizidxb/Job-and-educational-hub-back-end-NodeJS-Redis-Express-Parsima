import { Router } from 'express';
import * as ReportsController from '../services/reports.controller.js';
import { requireRole } from '../middleware/authz.js';

const router = Router();

// GET /api/reports
router.get('/', requireRole(['admin']), ReportsController.overview);

export default router;
