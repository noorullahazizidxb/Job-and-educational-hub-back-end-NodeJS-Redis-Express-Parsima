import { Router } from 'express';
import * as StatsController from '../services/stats.controller.js';

const router = Router();

// GET /api/stats/overview
router.get('/overview', StatsController.overview);

export default router;
