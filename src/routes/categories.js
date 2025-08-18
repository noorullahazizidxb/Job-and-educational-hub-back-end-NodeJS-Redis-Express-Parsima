import { Router } from 'express';
import * as CategoriesController from '../services/categories.controller.js';
import { validate } from '../utils/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validation/categories.schema.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

router.get('/', CategoriesController.list);
router.post('/', requireAdmin(), validate(createCategorySchema), CategoriesController.create);
router.get('/:id', CategoriesController.detail);
router.patch('/:id', requireAdmin(), validate(updateCategorySchema), CategoriesController.update);
router.delete('/:id', requireAdmin(), CategoriesController.remove);

export default router;
