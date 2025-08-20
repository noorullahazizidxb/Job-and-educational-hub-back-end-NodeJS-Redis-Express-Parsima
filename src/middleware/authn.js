import { verifyToken } from '../utils/jwt.js';
import { unauthorized } from '../utils/httpError.js';

export function authenticate(req, _res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
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
