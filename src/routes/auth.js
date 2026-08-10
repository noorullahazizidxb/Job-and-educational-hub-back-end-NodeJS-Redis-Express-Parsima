import { Router } from 'express';
import * as AuthController from '../services/auth.controller.js';
import { validate } from '../utils/validate.js';
import Joi from 'joi';
import { loginRateLimitMiddleware } from '../middleware/rateLimit.js';

const router = Router();

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  recaptchaToken: Joi.string().allow('', null).optional(),
});

router.post('/login', loginRateLimitMiddleware, validate(loginSchema), AuthController.login);
router.get('/me', AuthController.me);

export default router;
