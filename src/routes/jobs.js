import { Router } from 'express';
import * as JobsController from '../services/jobs.controller.js';
import { validate } from '../utils/validate.js';
import { createJobSchema, updateJobSchema, listJobsSchema, createJobReviewSchema } from '../validation/jobs.schema.js';
import { incrementMetricAllPeriods } from '../lib/metrics.js';
import { requireRole, requireAdmin } from '../middleware/authz.js';

const router = Router();

// Track viewers: every GET /api/jobs increments a Redis-based counter with 1-year TTL
router.get('/', async (req, res, next) => {
	try {
		// Increment counters for job viewers
		await incrementMetricAllPeriods('metrics:jobs:viewers');
	} catch (e) { /* ignore metrics errors */ }
	return validate(listJobsSchema, 'query')(req, res, (err) => {
		if (err) return next(err);
		return JobsController.list(req, res, next);
	});
});
// Featured jobs (full relations like list/detail)
router.get('/featured', JobsController.featured);
// Get jobs by companyId
router.get('/by-company/:companyId', requireRole(['company', 'admin', 'employee']), JobsController.listByCompany);
router.post('/', requireRole(['company', 'admin', 'employee']), validate(createJobSchema), JobsController.create);
router.get('/:slug', JobsController.detail);
router.post('/:slug/views', JobsController.addView);
router.get('/:slug/reviews', JobsController.listReviews);
router.post('/:slug/reviews', requireRole(['common']), validate(createJobReviewSchema), JobsController.createReview);
router.patch('/:slug', requireRole(['company', 'admin', 'employee']), validate(updateJobSchema), JobsController.update);
router.delete('/:slug', requireRole(['company', 'admin', 'employee']), JobsController.remove);

export default router;
