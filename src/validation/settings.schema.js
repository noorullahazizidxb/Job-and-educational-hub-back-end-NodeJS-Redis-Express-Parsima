import Joi from 'joi';

export const upsertSettingSchema = Joi.object({
  value: Joi.string().allow('', null),
  json: Joi.any(),
});
