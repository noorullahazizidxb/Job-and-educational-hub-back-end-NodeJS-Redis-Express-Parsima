export function httpError(status, message) {
  const err = new Error(message || 'Error');
  err.status = status || 500;
  return err;
}

export function notFound(message = 'Not found') {
  return httpError(404, message);
}

export function unauthorized(message = 'Unauthorized') {
  return httpError(401, message);
}

export function forbidden(message = 'Forbidden') {
  return httpError(403, message);
}
