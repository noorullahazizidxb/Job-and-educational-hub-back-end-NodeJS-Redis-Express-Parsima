import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
import { httpError } from '../utils/httpError.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { incrementMetricAllPeriods } from '../lib/metrics.js';
import { verifyRecaptchaToken } from '../utils/recaptcha.js';
import { verifyGoogleIdToken } from '../utils/google.js';

function withoutPassword(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function issueSession(user) {
  const token = signToken({ sub: user.id, role: user.role, companyId: user.companyId || null });
  try { await del(`auth:me:${user.id}`); } catch { /* ignore cache errors */ }
  try { await incrementMetricAllPeriods('metrics:auth:logins'); } catch { /* ignore metrics errors */ }
  return { token, user: withoutPassword(user) };
}

export async function login(req, res, next) {
  try {
    await verifyRecaptchaToken(req.body?.recaptchaToken, {
      expectedAction: 'login',
      remoteip: req.ip,
    });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(httpError(401, 'Invalid credentials'));
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return next(httpError(401, 'Invalid credentials'));
    res.json(await issueSession(user));
  } catch (err) { next(err); }
}

export async function loginWithGoogle(req, res, next) {
  try {
    const profile = await verifyGoogleIdToken(req.body?.idToken);
    let user = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleSub: profile.sub,
            name: user.name || profile.name,
            photo: user.photo || profile.picture,
          },
        });
      }
    }
    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: profile.email,
          googleSub: profile.sub,
          passwordHash,
          name: profile.name,
          photo: profile.picture,
          role: 'common',
        },
      });
    }
    res.json(await issueSession(user));
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
      const safeUser = withoutPassword(user);
      try { await setJson(cacheKey, safeUser, 30); } catch (e) { /* ignore cache errors */ }
      res.json({ user: safeUser });
  } catch (err) { next(err); }
}
