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

const googleSchema = Joi.object({
  idToken: Joi.string().min(20).required(),
});

router.post('/login', loginRateLimitMiddleware, validate(loginSchema), AuthController.login);
router.post('/google', validate(googleSchema), AuthController.loginWithGoogle);
router.get('/me', AuthController.me);

export default router;
