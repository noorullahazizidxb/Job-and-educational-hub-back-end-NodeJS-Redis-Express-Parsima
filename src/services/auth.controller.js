import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
import { httpError } from '../utils/httpError.js';

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
      res.json({ token, user: safeUser });
  } catch (err) { next(err); }
}

export async function me(req, res, next) {
  try {
  if (!req.user) return res.status(200).json({ user: null });
  const userId = Number(req.user.id ?? req.user.sub);
    const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(200).json({ user: null });
      const { passwordHash, ...safeUser } = user;
      res.json({ user: safeUser });
  } catch (err) { next(err); }
}
