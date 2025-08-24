import { Router } from 'express';
import * as CompaniesController from '../services/companies.controller.js';
import { validate } from '../utils/validate.js';
import { createCompanySchema, updateCompanySchema } from '../validation/companies.schema.js';
import Joi from 'joi';
import { requireRole, requireAdmin } from '../middleware/authz.js';

const router = Router();

const listCompaniesSchema = Joi.object({
	q: Joi.string().allow(''),
	cityId: Joi.number().integer(),
	page: Joi.forbidden(),
	pageSize: Joi.forbidden(),
});

router.get('/', validate(listCompaniesSchema, 'query'), CompaniesController.list);
router.post('/', requireRole(['company', 'admin', 'employee']), validate(createCompanySchema), CompaniesController.create);
router.get('/:id', CompaniesController.detail); // accepts id or slug
router.patch('/:id', requireRole(['company', 'admin', 'employee']), validate(updateCompanySchema), CompaniesController.update);
router.delete('/:id', requireRole(['admin', 'employee']), CompaniesController.remove);

export default router;
