import { Router } from 'express';
import * as UsersController from '../services/users.controller.js';
import { validate } from '../utils/validate.js';
import { createUserSchema, updateUserSchema, listUsersSchema } from '../validation/users.schema.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

router.get('/', requireAdmin(), validate(listUsersSchema, 'query'), UsersController.list);
// Allow public creation of users with role 'common'. Controller will enforce
// that creating non-'common' roles requires an admin.
router.post('/', validate(createUserSchema), UsersController.create);
router.get('/:id', requireAdmin(), UsersController.detail);
router.patch('/:id', requireAdmin(), validate(updateUserSchema), UsersController.update);
router.delete('/:id', requireAdmin(), UsersController.remove);

export default router;
