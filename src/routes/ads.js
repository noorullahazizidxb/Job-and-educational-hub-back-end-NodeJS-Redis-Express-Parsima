import { Router } from 'express';
import * as AdsController from '../services/ads.controller.js';
import { validate } from '../utils/validate.js';
import { createAdSchema, updateAdSchema, listAdsQuerySchema } from '../validation/ads.schema.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

router.get('/', validate(listAdsQuerySchema, 'query'), AdsController.list);
router.post('/', requireAdmin(), validate(createAdSchema), AdsController.create);
router.get('/:id', AdsController.detail);
router.patch('/:id', requireAdmin(), validate(updateAdSchema), AdsController.update);
router.delete('/:id', requireAdmin(), AdsController.remove);

export default router;
