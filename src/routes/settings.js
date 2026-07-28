import { Router } from 'express';
import * as SettingsController from '../services/settings.controller.js';
import { validate } from '../utils/validate.js';
import { upsertSettingSchema } from '../validation/settings.schema.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

// Theme moved to frontend ui-context JSON (Phase 5). Thin 410 stubs so /theme
// does not fall through to generic /:key for leftover clients.
const themeGone = (_req, res) => {
  res.status(410).json({
    error: 'Gone',
    message:
      'Theme settings are no longer served by this API. Persist theme via the frontend ui-context store.',
  });
};
router.get('/theme', themeGone);
router.put('/theme', themeGone);

// List all settings (admin/employee intended)
router.get('/', requireAdmin(), SettingsController.list);

// Get single setting by key
router.get('/:key', requireAdmin(), SettingsController.getByKey);

// Upsert a setting
router.put('/:key', requireAdmin(), validate(upsertSettingSchema), SettingsController.upsert);

export default router;
