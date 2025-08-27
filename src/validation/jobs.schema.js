import Joi from 'joi';

const type = Joi.string().valid('full_time','part_time','contract','internship','temporary','remote');
const status = Joi.string().valid('draft','published','closed');
const experience = Joi.string().valid('entry','mid','senior','lead');
const education = Joi.string().valid('high_school','diploma','bachelor','master','doctorate');
const gender = Joi.string().valid('any','male','female');
const orgType = Joi.string().valid('private','government','ngo','international_org','other');

export const listJobsSchema = Joi.object({
  q: Joi.string().allow('').optional(),
  location: Joi.string().allow('').optional(),
  type: type.optional(),
  status: status.optional(),
  cityId: Joi.number().integer().optional(),
  categoryId: Joi.number().integer().optional(),
  featured: Joi.boolean().optional(),
  withReviews: Joi.boolean().optional(),
  withReviewsCount: Joi.number().integer().min(0).max(10).optional(),
  page: Joi.forbidden(),
  pageSize: Joi.forbidden(),
}).unknown(false);

const baseJob = {
  title: Joi.string().min(3).required(),
  slug: Joi.string().regex(/^[a-z0-9-]+$/).required(),
  companyId: Joi.number().integer().required(),
  type: type.required(),
  location: Joi.string().required(),
  salaryMin: Joi.alternatives().try(Joi.number().min(0), Joi.string().allow(''), Joi.valid(null)).optional(),
  salaryMax: Joi.alternatives().try(Joi.number().min(0), Joi.string().allow(''), Joi.valid(null)).optional(),
  currency: Joi.string().default('USD').optional(),
  description: Joi.string().min(20).required(),
  skills: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).required(),
  benefits: Joi.string().optional(),
  applyUrl: Joi.string().uri().optional(),
  applyEmail: Joi.string().email().optional(),
  contactEmail: Joi.string().email().optional(),
  closingDate: Joi.date().optional(),
  vacancies: Joi.number().integer().min(1).optional(),
  experience: experience.optional(),
  education: education.optional(),
  gender: gender.optional(),
  orgType: orgType.optional(),
  status: status.optional(),
  featured: Joi.alternatives().try(Joi.boolean(), Joi.string().allow('')).optional(),
  featuredUntil: Joi.alternatives().try(Joi.date(), Joi.string().allow(''), Joi.valid(null)).optional(),
  cityId: Joi.number().integer().optional(),
  categoryIds: Joi.array().items(Joi.number().integer()).optional(),
};

export const createJobSchema = Joi.object(baseJob)
  .custom((value, helpers) => {
    if (value.salaryMin != null && value.salaryMax != null && value.salaryMin > value.salaryMax) {
      return helpers.error('any.invalid', { message: 'salaryMin cannot be greater than salaryMax' });
    }
    if (value.closingDate && new Date(value.closingDate) < new Date()) {
      // allow past closingDate if importing, but warn by default
      // return helpers.error('any.invalid', { message: 'closingDate must be in the future' });
    }
    return value;
  })
  .unknown(false);

export const updateJobSchema = Joi.object({ ...baseJob })
  .fork(Object.keys(baseJob), (s) => s.optional())
  .custom((value, helpers) => {
    if (value.salaryMin != null && value.salaryMax != null && value.salaryMin > value.salaryMax) {
      return helpers.error('any.invalid', { message: 'salaryMin cannot be greater than salaryMax' });
    }
    return value;
  })
  .unknown(false);

export const createJobReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').optional(),
}).unknown(false);
