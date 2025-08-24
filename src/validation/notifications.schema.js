import Joi from 'joi';

export const listNotificationsSchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.forbidden(),
  pageSize: Joi.forbidden(),
});

export const inboxQuerySchema = Joi.object({
  page: Joi.forbidden(),
  pageSize: Joi.forbidden(),
  unreadOnly: Joi.boolean().default(false),
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
})
.custom((val, helpers) => {
  const hasTargetAll = !!val.targetAll;
  const hasTargetRole = !!val.targetRole;
  const hasRecipients = (Array.isArray(val.recipientUserIds) && val.recipientUserIds.length > 0) ||
                        (Array.isArray(val.recipientCompanyIds) && val.recipientCompanyIds.length > 0);
  if (!hasTargetAll && !hasTargetRole && !hasRecipients) {
    return helpers.error('any.invalid', { message: 'Provide targetAll, targetRole, or at least one recipient id' });
  }
  return val;
})
.unknown(false);

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
