import Joi from 'joi';

export const upsertSettingSchema = Joi.object({
  value: Joi.string().allow('', null),
  json: Joi.any(),
});

// Theme-specific schema: full theming with tokens
const colorSchema = Joi.string().min(1).messages({
  'string.base': 'Color must be a string',
  'string.empty': 'Color cannot be empty',
});

const paletteSchema = Joi.object({
  primary: colorSchema.required(),
  accent: colorSchema.required(),
  secondary: colorSchema.required(),
  background: colorSchema.required(),
  surface: colorSchema.required(),
  muted: colorSchema.required(),
  text: colorSchema.required(),
  border: colorSchema.required(),
  success: colorSchema.required(),
  warning: colorSchema.required(),
  danger: colorSchema.required(),
}).required();

const tokensSchema = Joi.object({
  radius: Joi.object({
    button: Joi.number().min(0).max(50).required(),
    input: Joi.number().min(0).max(50).required(),
    card: Joi.number().min(0).max(64).required(),
  }).required(),
  spacing: Joi.object({
    xs: Joi.number().min(0).required(),
    sm: Joi.number().min(0).required(),
    md: Joi.number().min(0).required(),
    lg: Joi.number().min(0).required(),
    xl: Joi.number().min(0).required(),
  }).required(),
  shadow: Joi.object({
    sm: Joi.string().min(1).required(),
    md: Joi.string().min(1).required(),
    lg: Joi.string().min(1).required(),
  }).required(),
  typography: Joi.object({
    fontFamily: Joi.string().min(1).required(),
    baseSize: Joi.number().min(10).max(24).required(),
    lineHeight: Joi.number().min(1).max(2).required(),
    weightRegular: Joi.number().required(),
    weightMedium: Joi.number().required(),
    weightBold: Joi.number().required(),
  }).required(),
  transition: Joi.object({
    duration: Joi.number().min(0).max(2000).required(),
    easing: Joi.string().min(1).required(),
  }).required(),
}).required();

export const upsertThemeSettingSchema = Joi.object({
  value: Joi.valid(null).allow(null),
  json: Joi.object({
    light: paletteSchema,
    dark: paletteSchema,
    tokens: tokensSchema,
  }).required(),
});
