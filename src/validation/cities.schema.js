import Joi from 'joi';

export const createCitySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  province: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).default('Afghanistan')
});

export const updateCitySchema = Joi.object({
  name: Joi.string().min(2).max(100),
  province: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100)
});
