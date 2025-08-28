import Joi from 'joi';

export const createAdSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  placement: Joi.string().valid(
  'job_list_top',
  'middle_of_job_list',
  'home_page_after_pagenation_1',
  'home_page_after_pagenation_2',
  'middle_of_related_jobs_on_job_details',
  'company_list_top',
  'middle_of_company_list',
  'middle_of_related_companies_on_company_details',
  'service_list_top',
  'middle_of_service_list',
  'middle_of_related_services_on_service_details'
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
  'job_list_top',
  'middle_of_job_list',
  'home_page_after_pagenation_1',
  'home_page_after_pagenation_2',
  'middle_of_related_jobs_on_job_details',
  'company_list_top',
  'middle_of_company_list',
  'middle_of_related_companies_on_company_details',
  'service_list_top',
  'middle_of_service_list',
  'middle_of_related_services_on_service_details'
  ),
  activeOnly: Joi.boolean().truthy('true', '1').falsy('false', '0').default(false),
  limit: Joi.number().integer().min(1).max(1000).optional()
});
