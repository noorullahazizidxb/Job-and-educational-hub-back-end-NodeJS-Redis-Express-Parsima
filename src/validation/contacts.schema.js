import Joi from 'joi';

export const createContactSchema = Joi.object({
  firstName: Joi.string().min(1).required(),
  lastName: Joi.string().allow('', null),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().allow('', null),
  message: Joi.string().min(5).required(),
}).unknown(false);

export const listContactsSchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.forbidden(),
  pageSize: Joi.forbidden(),
});
