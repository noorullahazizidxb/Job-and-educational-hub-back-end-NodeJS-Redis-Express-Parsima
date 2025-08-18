import Joi from 'joi';

export const createAdSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  placement: Joi.string().valid(
    'homepage_hero',
    'homepage_sidebar',
    'job_list_top',
    'job_detail_sidebar',
    'sitewide_banner'
  ).required(),
  imageUrl: Joi.string().uri().required(),
  targetUrl: Joi.string().uri().required(),
  isActive: Joi.boolean().default(true),
  startAt: Joi.date().optional().allow(null),
  endAt: Joi.date().optional().allow(null),
  priority: Joi.number().integer().min(0).default(0)
}).custom((value, helpers) => {
  if (value.startAt && value.endAt && new Date(value.startAt) > new Date(value.endAt)) {
    return helpers.error('any.invalid', { message: 'startAt must be <= endAt' });
  }
  return value;
}, 'Date range validation');

export const updateAdSchema = createAdSchema.fork(
  ['title', 'placement', 'imageUrl', 'targetUrl'],
  (schema) => schema.optional()
);

export const listAdsQuerySchema = Joi.object({
  placement: Joi.string().valid(
    'homepage_hero',
    'homepage_sidebar',
    'job_list_top',
    'job_detail_sidebar',
    'sitewide_banner'
  ),
  activeOnly: Joi.boolean().truthy('true', '1').falsy('false', '0').default(false),
  limit: Joi.number().integer().min(1).max(50).default(10)
});
