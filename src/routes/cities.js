import { Router } from 'express';
import * as CitiesController from '../services/cities.controller.js';
import { validate } from '../utils/validate.js';
import { createCitySchema, updateCitySchema } from '../validation/cities.schema.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

router.get('/', CitiesController.list);
router.post('/', requireAdmin(), validate(createCitySchema), CitiesController.create);
router.get('/:id', CitiesController.detail);
router.patch('/:id', requireAdmin(), validate(updateCitySchema), CitiesController.update);
router.delete('/:id', requireAdmin(), CitiesController.remove);

export default router;
