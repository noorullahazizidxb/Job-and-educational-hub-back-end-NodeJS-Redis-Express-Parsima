import { Router } from 'express';
import * as AuthController from '../services/auth.controller.js';
import { validate } from '../utils/validate.js';
import Joi from 'joi';

const router = Router();

const loginSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(6).required() });

router.post('/login', validate(loginSchema), AuthController.login);
router.get('/me', AuthController.me);

export default router;
