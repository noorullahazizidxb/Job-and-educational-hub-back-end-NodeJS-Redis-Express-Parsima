// Minimal role guard using request headers.
import { forbidden, unauthorized } from '../utils/httpError.js';
// NOTE: Replace with real auth (JWT/session) later. For now, set X-Role header to one of:
// 'common' | 'company' | 'admin' | 'employee'

export function requireRole(allowed) {
  const allowedArr = Array.isArray(allowed) ? allowed : [allowed];
  const allowedSet = new Set(allowedArr.map((a) => String(a).toLowerCase()));
  return (req, res, next) => {
    // Require an authenticated user. Do not allow role-only header to bypass auth.
    if (!req.user) return next(unauthorized());
    const role = String(req.user.role || '').toLowerCase();
    if (!allowedSet.has(role)) return next(forbidden());
    next();
  };
}

export function requireAdmin() {
  return requireRole(['admin', 'employee']);
}
