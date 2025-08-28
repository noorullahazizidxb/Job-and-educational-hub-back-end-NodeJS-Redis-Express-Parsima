import Joi from 'joi';

export const listUsersSchema = Joi.object({
  q: Joi.string().allow(''),
  role: Joi.string().valid('common', 'company', 'admin', 'employee'),
  // pagination removed: controllers return full arrays
  page: Joi.forbidden(),
  pageSize: Joi.forbidden(),
});

export const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  // Accept either a plaintext password (will be hashed server-side) or a pre-hashed passwordHash
  password: Joi.string().min(8),
  passwordHash: Joi.string().min(10),
  name: Joi.string().max(120).allow('', null),
  role: Joi.string().valid('common', 'company', 'admin', 'employee').default('common'),
  companyId: Joi.number().integer().allow(null),
  photo: Joi.string().uri().allow('', null),
}).or('password', 'passwordHash');

export const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string().min(8),
  passwordHash: Joi.string().min(10),
  name: Joi.string().max(120).allow('', null),
  role: Joi.string().valid('common', 'company', 'admin', 'employee'),
  companyId: Joi.number().integer().allow(null),
  photo: Joi.string().uri().allow('', null),
});
