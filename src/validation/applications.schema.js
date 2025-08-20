import Joi from 'joi';

export const createJobApplicationSchema = Joi.object({
  jobId: Joi.number().integer().required(),
  userId: Joi.number().integer().required(),
  fullName: Joi.string().max(120).required(),
  email: Joi.string().email().required(),
  cvUrl: Joi.string().uri().allow('', null),
  coverLetter: Joi.string().allow('', null),
  answers: Joi.any(),
});

export const createServiceApplicationSchema = Joi.object({
  serviceId: Joi.number().integer().required(),
  userId: Joi.number().integer().required(),
  fullName: Joi.string().max(120).required(),
  email: Joi.string().email().required(),
  cvUrl: Joi.string().uri().allow('', null),
  coverLetter: Joi.string().allow('', null),
});

export const listApplicationsSchema = Joi.object({
  jobId: Joi.number().integer(),
  serviceId: Joi.number().integer(),
  userId: Joi.number().integer(),
  status: Joi.string().valid('applied', 'viewed', 'shortlisted', 'rejected', 'hired', 'withdrawn'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});
