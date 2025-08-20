import Joi from 'joi';

export const listReviewsSchema = Joi.object({
  jobId: Joi.number().integer().required(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const createReviewSchema = Joi.object({
  jobId: Joi.number().integer().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
});

export const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  comment: Joi.string().allow('', null),
});
