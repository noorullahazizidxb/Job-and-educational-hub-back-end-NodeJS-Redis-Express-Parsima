// Response envelope middleware: standardizes API responses across controllers with minimal changes.
// - Success: { success: true, status, entity, message, data } or { items, total, page, pageSize }
// - Error (handled in global error handler): { success: false, status, entity, message }

export function getEntityFromRequest(req) {
  try {
    const url = String(req.baseUrl || req.originalUrl || '').toLowerCase();
    if (!url.startsWith('/api/')) return 'unknown';

    // Extract the top-level resource after /api/
    const afterApi = url.slice(5); // remove '/api/'
    const seg = afterApi.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const resource = seg[0] || '';
    const fullPath = `/api/${seg.join('/')}`;

    // Direct mapping to Prisma model names
    const map = {
      jobs: 'Job',
      companies: 'Company',
      services: 'Service',
      categories: 'Category',
      cities: 'City',
      ads: 'Advertisement',
      users: 'User',
      settings: 'Setting',
      notifications: 'Notification',
      reviews: 'JobReview',
      auth: 'Auth',
    };

    if (resource === 'applications') {
      if (fullPath.includes('/applications/jobs')) return 'JobApplication';
      if (fullPath.includes('/applications/services')) return 'ServiceApplication';
      return 'Application';
    }

    if (map[resource]) return map[resource];

    // Fallback: singularize basic plurals
    const singular = resource.endsWith('ies')
      ? resource.slice(0, -3) + 'y'
      : resource.endsWith('s')
      ? resource.slice(0, -1)
      : resource;
    return singular ? singular.charAt(0).toUpperCase() + singular.slice(1) : 'unknown';
  } catch {
    return 'unknown';
  }
}

function defaultMessage(method) {
  switch (String(method).toUpperCase()) {
  case 'POST': return 'Created successfully';
    case 'PATCH':
  case 'PUT': return 'Updated successfully';
  case 'DELETE': return 'Deleted successfully';
  default: return 'Fetched successfully';
  }
}

export function responseEnvelope() {
  return (req, res, next) => {
    // Only wrap API routes
    const isApi = (req.baseUrl || req.originalUrl || '').startsWith('/api/');
    if (!isApi) return next();

  req.entity = getEntityFromRequest(req);

    const _json = res.json.bind(res);
    const _end = res.end.bind(res);

    // Helper to send success envelope
    res.sendSuccess = (payload, message, status) => {
      const statusCode = status || res.statusCode || 200;
      const baseMsg = message || defaultMessage(req.method);
      const fullMsg = req.entity && req.entity !== 'unknown' ? `${req.entity} ${baseMsg}` : baseMsg;
      const body = { success: true, status: statusCode, entity: req.entity, message: fullMsg };
      if (payload && typeof payload === 'object' && 'items' in payload && 'total' in payload) {
        Object.assign(body, payload);
      } else {
        body.data = payload;
      }
      return _json(body);
    };

    // Override res.json to auto-wrap if not already wrapped
    res.json = (payload) => {
      // Pass-through if payload already has success key (assume controller opted-in)
      if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
        return _json(payload);
      }
      return res.sendSuccess(payload);
    };

    // Convert 204 deletes to a standard JSON envelope
    res.end = (chunk, encoding, cb) => {
      if (res.statusCode === 204 && req.method === 'DELETE') {
        res.statusCode = 200;
        const baseMsg = defaultMessage('DELETE');
        const fullMsg = req.entity && req.entity !== 'unknown' ? `${req.entity} ${baseMsg}` : baseMsg;
        return _json({ success: true, status: 200, entity: req.entity, message: fullMsg });
      }
      return _end(chunk, encoding, cb);
    };

    next();
  };
}
