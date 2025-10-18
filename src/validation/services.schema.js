import Joi from 'joi';

const type = Joi.string().valid('procurement','scholarship');
const status = Joi.string().valid('draft','published','closed');

export const listServicesSchema = Joi.object({
  q: Joi.string().allow('').optional(),
  type: type.optional(),
  status: status.optional(),
  featured: Joi.boolean().optional(),
  cityId: Joi.number().integer().optional(),
  page: Joi.forbidden(),
  pageSize: Joi.forbidden(),
}).unknown(false);

export const createServiceSchema = Joi.object({
  type: type.required(),
  title: Joi.string().min(3).required(),
  slug: Joi.string().regex(/^[a-z0-9-]+$/).required(),
  description: Joi.string().min(20).required(),
  organization: Joi.string().optional(),
  companyId: Joi.number().integer().optional(),
  cityId: Joi.number().integer().optional(),
  country: Joi.string().optional(),
  category: Joi.string().optional(),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  eligibility: Joi.string().optional(),
  documents: Joi.any().optional(),
  applyUrl: Joi.string().uri().optional(),
  contactEmail: Joi.string().email().optional(),
  closingDate: Joi.date().optional(),
  status: status.optional(),
  featured: Joi.boolean().optional(),
}).unknown(false);

export const updateServiceSchema = createServiceSchema.fork(['type','title','slug','description'], (s) => s.optional());
