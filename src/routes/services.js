import { Router } from 'express';
import * as ServicesController from '../services/services.controller.js';
import { validate } from '../utils/validate.js';
import { uploadService } from '../middleware/upload.js';
import { createServiceSchema, updateServiceSchema, listServicesSchema } from '../validation/services.schema.js';
import { requireRole } from '../middleware/authz.js';

const router = Router();

router.get('/', validate(listServicesSchema, 'query'), ServicesController.list);
// Get services by companyId
router.get('/by-company/:companyId', requireRole(['company', 'admin', 'employee']), ServicesController.listByCompany);
// accept optional service documents upload (field name: documents)
router.post('/', requireRole(['company', 'admin', 'employee']), uploadService.array('documents', 5), validate(createServiceSchema), ServicesController.create);
router.get('/:slug', ServicesController.detail);
router.patch('/:slug', requireRole(['company', 'admin', 'employee']), uploadService.array('documents', 5), validate(updateServiceSchema), ServicesController.update);
router.delete('/:slug', requireRole(['company', 'admin', 'employee']), ServicesController.remove);

export default router;
