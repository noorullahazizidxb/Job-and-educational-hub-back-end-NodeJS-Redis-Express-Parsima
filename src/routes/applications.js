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

export default router;
