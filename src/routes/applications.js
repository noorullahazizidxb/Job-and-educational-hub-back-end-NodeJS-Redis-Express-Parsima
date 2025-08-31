import { Router } from 'express';
import * as ApplicationsController from '../services/applications.controller.js';
import { validate } from '../utils/validate.js';
import { createJobApplicationSchema, createServiceApplicationSchema, listApplicationsSchema } from '../validation/applications.schema.js';
import { requireAdmin, requireRole } from '../middleware/authz.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Job applications
router.get('/jobs', requireAdmin(), validate(listApplicationsSchema, 'query'), ApplicationsController.listJobApplications);
router.post(
	'/jobs',
	requireRole(['common']),
	upload.fields([
		{ name: 'cv', maxCount: 1 },
		{ name: 'coverLetter', maxCount: 1 },
	]),
	validate(createJobApplicationSchema),
	ApplicationsController.applyToJob
);

// Service applications
router.get('/services', requireAdmin(), validate(listApplicationsSchema, 'query'), ApplicationsController.listServiceApplications);
router.post(
	'/services',
	requireRole(['common']),
	upload.fields([
		{ name: 'cv', maxCount: 1 },
		{ name: 'coverLetter', maxCount: 1 },
	]),
	validate(createServiceApplicationSchema),
	ApplicationsController.applyToService
);

// Status change endpoints for job applications (admin & company only)
router.patch('/jobs/:id/viewed', requireRole(['admin','company']), ApplicationsController.markJobApplicationViewed);
router.patch('/jobs/:id/shortlisted', requireRole(['admin','company']), ApplicationsController.markJobApplicationShortlisted);
router.patch('/jobs/:id/rejected', requireRole(['admin','company']), ApplicationsController.markJobApplicationRejected);
router.patch('/jobs/:id/hired', requireRole(['admin','company']), ApplicationsController.markJobApplicationHired);
router.patch('/jobs/:id/withdrawn', requireRole(['admin','company']), ApplicationsController.markJobApplicationWithdrawn);

// Status change endpoints for service applications (admin & company only)
router.patch('/services/:id/viewed', requireRole(['admin','company']), ApplicationsController.markServiceApplicationViewed);
router.patch('/services/:id/shortlisted', requireRole(['admin','company']), ApplicationsController.markServiceApplicationShortlisted);
router.patch('/services/:id/rejected', requireRole(['admin','company']), ApplicationsController.markServiceApplicationRejected);
router.patch('/services/:id/hired', requireRole(['admin','company']), ApplicationsController.markServiceApplicationHired);
router.patch('/services/:id/withdrawn', requireRole(['admin','company']), ApplicationsController.markServiceApplicationWithdrawn);

export default router;
