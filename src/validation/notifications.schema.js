import Joi from 'joi';

export const listNotificationsSchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const createNotificationSchema = Joi.object({
  title: Joi.string().min(1).required(),
  body: Joi.string().allow('', null),
  link: Joi.string().uri().allow('', null),
  targetAll: Joi.boolean().default(false),
  targetRole: Joi.string().valid('common', 'company', 'admin', 'employee').allow(null),
  sendAt: Joi.date().allow(null),
  recipientUserIds: Joi.array().items(Joi.number().integer()).default([]),
  recipientCompanyIds: Joi.array().items(Joi.number().integer()).default([]),
}).unknown(false);

export const updateNotificationSchema = Joi.object({
  title: Joi.string().min(1),
  body: Joi.string().allow('', null),
  link: Joi.string().uri().allow('', null),
  targetAll: Joi.boolean(),
  targetRole: Joi.string().valid('common', 'company', 'admin', 'employee').allow(null),
  sendAt: Joi.date().allow(null),
  recipientUserIds: Joi.array().items(Joi.number().integer()),
  recipientCompanyIds: Joi.array().items(Joi.number().integer()),
}).unknown(false);

export const markReadSchema = Joi.object({}).unknown(false);
