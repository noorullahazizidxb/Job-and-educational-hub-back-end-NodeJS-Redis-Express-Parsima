import { Router } from 'express';
import * as JobsController from '../services/jobs.controller.js';
import { validate } from '../utils/validate.js';
import { createJobSchema, updateJobSchema, listJobsSchema, createJobReviewSchema } from '../validation/jobs.schema.js';
import { requireRole, requireAdmin } from '../middleware/authz.js';

const router = Router();

router.get('/', validate(listJobsSchema, 'query'), JobsController.list);
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
