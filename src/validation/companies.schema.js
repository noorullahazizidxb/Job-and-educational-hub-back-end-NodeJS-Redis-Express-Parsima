import Joi from 'joi';

export const createCompanySchema = Joi.object({
  name: Joi.string().min(2).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).optional(),
  website: Joi.string().uri().optional(),
  logoUrl: Joi.string().uri().optional(),
  industry: Joi.string().max(120).allow('', null),
  size: Joi.string().max(50).allow('', null),
  about: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  cityId: Joi.number().integer().allow(null),
}).unknown(false);

export const updateCompanySchema = createCompanySchema.fork(['name'], (s) => s.optional());
