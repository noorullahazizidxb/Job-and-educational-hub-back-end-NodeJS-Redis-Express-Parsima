export function validate(schema, from = 'body') {
  return (req, _res, next) => {
    const source = from === 'query' ? req.query : req.body;
    const { value, error } = schema.validate(source, { abortEarly: false, stripUnknown: true });
    if (error) {
      error.status = 400;
      error.isJoi = true;
      // Prefer the first detailed message as error.message for central handler
      if (error.details && error.details.length) {
        error.message = error.details[0].message;
      }
      return next(error);
    }
    if (from === 'query') req.query = value; else req.body = value;
    next();
  };
}
