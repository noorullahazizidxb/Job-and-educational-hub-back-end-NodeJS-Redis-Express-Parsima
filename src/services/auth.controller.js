import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
import { httpError } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return next(httpError(401, 'Invalid credentials'));
    const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return next(httpError(401, 'Invalid credentials'));
    const token = signToken({ sub: user.id, role: user.role, companyId: user.companyId || null });
      // exclude passwordHash from the returned user
      const { passwordHash, ...safeUser } = user;
      // ensure any cached `me` is refreshed after login
      try { await del(`auth:me:${user.id}`); } catch (e) { /* ignore cache errors */ }
      res.json({ token, user: safeUser });
  } catch (err) { next(err); }
}

export async function me(req, res, next) {
  try {
  if (!req.user) return res.status(200).json({ user: null });
  const userId = Number(req.user.id ?? req.user.sub);
    const cacheKey = `auth:me:${userId}`;
    const cached = await getJson(cacheKey);
    if (cached) return res.json({ user: cached });
    const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(200).json({ user: null });
      const { passwordHash, ...safeUser } = user;
      try { await setJson(cacheKey, safeUser, 30); } catch (e) { /* ignore cache errors */ }
      res.json({ user: safeUser });
  } catch (err) { next(err); }
}
