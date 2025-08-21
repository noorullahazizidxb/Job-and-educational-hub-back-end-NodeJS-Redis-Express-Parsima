import { Router } from 'express';
import * as ReviewsController from '../services/reviews.controller.js';
import { validate } from '../utils/validate.js';
import { requireRole, requireAdmin } from '../middleware/authz.js';
import { listReviewsSchema, createReviewSchema, updateReviewSchema } from '../validation/reviews.schema.js';

const router = Router();

// Public list by jobId
router.get('/', validate(listReviewsSchema, 'query'), ReviewsController.list);
// Create review for a job by authenticated common user
router.post('/', requireRole(['common']), validate(createReviewSchema), ReviewsController.create);
// Admin can update/delete reviews
router.patch('/:id', requireAdmin(), validate(updateReviewSchema), ReviewsController.update);
router.delete('/:id', requireAdmin(), ReviewsController.remove);

export default router;
