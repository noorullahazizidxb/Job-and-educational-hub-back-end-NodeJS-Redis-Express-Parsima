import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/httpError.js';

export async function list(_req, res, next) {
  try {
    const items = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    res.json(items);
  } catch (err) { next(err); }
}

export async function getByKey(req, res, next) {
  try {
    const { key } = req.params;
  const item = await prisma.setting.findUnique({ where: { key } });
  if (!item) return next(notFound());
    res.json(item);
  } catch (err) { next(err); }
}

export async function upsert(req, res, next) {
  try {
    const { key } = req.params;
    const { value, json } = req.body;
    const item = await prisma.setting.upsert({
      where: { key },
      update: { value, json },
      create: { key, value, json },
    });
    res.json(item);
  } catch (err) { next(err); }
}

// Upsert theme settings specifically to key 'theme'
export async function upsertTheme(req, res, next) {
  try {
    const { value, json } = req.body; // value is expected to be null
    const key = 'theme';

    const item = await prisma.setting.upsert({
      where: { key },
      update: { value, json },
      create: { key, value, json },
    });
    res.json(item);
  } catch (err) { next(err); }
}

// Public: Get theme without admin requirement
export async function getTheme(_req, res, next) {
  try {
    const key = 'theme';
    const item = await prisma.setting.findUnique({ where: { key } });
    if (!item) {
      // Fallback default palette mirrors seed.js defaults
    return res.json({
        key,
        value: null,
        json: {
          light: {
            primary: '#3b82f6', accent: '#8b5cf6', secondary: '#06b6d4',
            background: '#ffffff', surface: '#f8fafc', muted: '#e5e7eb', text: '#0f172a', border: '#e2e8f0',
            success: '#22c55e', warning: '#f59e0b', danger: '#ef4444'
          },
          dark: {
            primary: '#60a5fa', accent: '#a78bfa', secondary: '#22d3ee',
            background: '#0b1220', surface: '#111827', muted: '#374151', text: '#e5e7eb', border: '#1f2937',
            success: '#4ade80', warning: '#fbbf24', danger: '#f87171'
          },
          tokens: {
            radius: { button: 6, input: 6, card: 10 },
            spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
            shadow: {
              sm: '0 1px 2px rgba(0,0,0,0.05)',
              md: '0 4px 6px rgba(0,0,0,0.1)',
              lg: '0 10px 15px rgba(0,0,0,0.15)'
            },
            typography: {
              fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
              baseSize: 16,
              lineHeight: 1.5,
              weightRegular: 400,
              weightMedium: 500,
              weightBold: 700,
            },
            transition: { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
          },
        },
      });
    }
    res.json(item);
  } catch (err) { next(err); }
}
