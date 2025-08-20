import { Router } from 'express';
import * as SettingsController from '../services/settings.controller.js';
import { validate } from '../utils/validate.js';
import { upsertSettingSchema, upsertThemeSettingSchema } from '../validation/settings.schema.js';
import { requireAdmin } from '../middleware/authz.js';

const router = Router();

// Public theme fetch
router.get('/theme', SettingsController.getTheme);

// List all settings (admin/employee intended)
router.get('/', requireAdmin(), SettingsController.list);

// Upsert theme settings with strict structure (admin only)
router.put('/theme', requireAdmin(), validate(upsertThemeSettingSchema), SettingsController.upsertTheme);

// Get single setting by key
router.get('/:key', requireAdmin(), SettingsController.getByKey);

// Upsert a setting
router.put('/:key', requireAdmin(), validate(upsertSettingSchema), SettingsController.upsert);

export default router;
