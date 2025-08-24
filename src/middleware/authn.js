import { verifyToken } from '../utils/jwt.js';
import { unauthorized } from '../utils/httpError.js';

export function authenticate(req, _res, next) {
  const auth = (req.headers.authorization || '').toString();
  // Accept both 'Bearer <token>' (case-insensitive) and raw token in Authorization header
  let token = null;
  if (!auth) return next();
  const parts = auth.split(' ').filter(Boolean);
  if (parts.length === 1) token = parts[0];
  else if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer') token = parts.slice(1).join(' ').trim();
  else token = parts.slice(1).join(' ').trim() || parts[0];
  if (!token) return next();
  try {
    const decoded = verifyToken(token);
    // Normalize decoded token into req.user. Some controllers expect `sub`,
    // others expect `id`. Provide both to be compatible.
    req.user = {
      ...decoded,
      id: decoded.sub ?? decoded.id,
      sub: decoded.sub ?? decoded.id,
    };
  } catch {
    // ignore invalid token, treat as anonymous
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  next();
}
