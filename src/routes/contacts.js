import { Router } from 'express';
import * as ContactsController from '../services/contacts.controller.js';
import { validate } from '../utils/validate.js';
import { requireAuth, authenticate } from '../middleware/authn.js';
import { createContactSchema, listContactsSchema } from '../validation/contacts.schema.js';

const router = Router();

// Public create endpoint
router.post('/', validate(createContactSchema), ContactsController.create);
// Admin endpoints
router.get('/', validate(listContactsSchema, 'query'), ContactsController.list);
router.get('/:id', ContactsController.detail);
router.delete('/:id', ContactsController.remove);

export default router;
