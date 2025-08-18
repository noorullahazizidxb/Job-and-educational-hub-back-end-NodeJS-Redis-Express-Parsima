import Joi from 'joi';

export const createCategorySchema = Joi.object({
  name: Joi.string().min(2).required(),
  slug: Joi.string().regex(/^[a-z0-9-]+$/).required(),
}).unknown(false);

export const updateCategorySchema = createCategorySchema.fork(['name','slug'], (s) => s.optional());
