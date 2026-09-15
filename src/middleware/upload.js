import fs from 'fs';
import path from 'path';
import os from 'os';
import multer from 'multer';
import { createQueue } from '../lib/queue.js';
import { blobEnabled, isVercel, queueEnabled } from '../lib/runtime.js';

const uploadRoot = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(process.cwd(), 'uploads');

if (!blobEnabled) {
  for (const dir of [uploadRoot, path.join(uploadRoot, 'services'), path.join(uploadRoot, 'profile')]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  if (isVercel) {
    console.warn('HOSTING_PLATFORM=vercel without BLOB_READ_WRITE_TOKEN: uploads go to /tmp and will not persist');
  }
}

function safeName(original) {
  const safeOriginal = String(original || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}_${safeOriginal}`;
}

function diskStorage(subdir = '') {
  const dest = subdir ? path.join(uploadRoot, subdir) : uploadRoot;
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
  });
}

const memoryStorage = multer.memoryStorage();
const storageBackend = blobEnabled ? memoryStorage : diskStorage();
const serviceStorage = blobEnabled ? memoryStorage : diskStorage('services');
const profileStorage = blobEnabled ? memoryStorage : diskStorage('profile');

const allowed = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function fileFilter(_req, file, cb) {
  if (allowed.has(file.mimetype)) return cb(null, true);
  cb(new Error('Invalid file type'));
}

const DEFAULT_FILE_LIMIT = Number(process.env.FILE_UPLOAD_LIMIT_BYTES) || 5 * 1024 * 1024;
const DEFAULT_SERVICE_LIMIT = Number(process.env.SERVICE_UPLOAD_LIMIT_BYTES) || 10 * 1024 * 1024;

function collectFiles(req) {
  const out = [];
  if (req.file) out.push(req.file);
  if (Array.isArray(req.files)) out.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    for (const value of Object.values(req.files)) {
      if (Array.isArray(value)) out.push(...value);
      else if (value) out.push(value);
    }
  }
  return out;
}

async function persistToBlob(file, folder) {
  const { put } = await import('@vercel/blob');
  const filename = file.filename || safeName(file.originalname);
  const blob = await put(`${folder}/${filename}`, file.buffer, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });
  file.filename = filename;
  file.blobUrl = blob.url;
}

function persistMiddleware(folder) {
  return async (req, _res, next) => {
    if (!blobEnabled) return next();
    try {
      for (const file of collectFiles(req)) {
        if (file?.buffer) await persistToBlob(file, folder);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function wrapMulter(instance, folder) {
  const run = (mw) => (req, res, next) => {
    mw(req, res, (err) => {
      if (err) return next(err);
      return persistMiddleware(folder)(req, res, next);
    });
  };
  return {
    single: (field) => run(instance.single(field)),
    array: (field, max) => run(instance.array(field, max)),
    fields: (fields) => run(instance.fields(fields)),
    none: () => run(instance.none()),
    any: () => run(instance.any()),
  };
}

const uploadRaw = multer({ storage: storageBackend, fileFilter, limits: { fileSize: DEFAULT_FILE_LIMIT } });
const uploadServiceRaw = multer({ storage: serviceStorage, fileFilter, limits: { fileSize: DEFAULT_SERVICE_LIMIT } });
const uploadProfileRaw = multer({
  storage: profileStorage,
  fileFilter: (_req, file, cb) => {
    const allowedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
    if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error('Invalid image type'));
  },
  limits: { fileSize: Number(process.env.PROFILE_UPLOAD_LIMIT_BYTES) || 5 * 1024 * 1024 },
});

export const upload = wrapMulter(uploadRaw, 'uploads');
export const uploadService = wrapMulter(uploadServiceRaw, 'uploads/services');
export const uploadProfile = wrapMulter(uploadProfileRaw, 'uploads/profile');

export function publicFileUrl(file, prefix = '/uploads') {
  if (!file) return null;
  if (file.blobUrl) return file.blobUrl;
  const base = String(prefix || '/uploads').replace(/\/$/, '');
  return `${base}/${file.filename}`;
}

export function enqueueProfileOptimization(req, file) {
  try {
    if (!queueEnabled || !file?.filename) return;
    const q = createQueue('image-processor');
    const filePath = `/uploads/profile/${file.filename}`;
    q.add('optimize', { filePath, mime: file.mimetype });
  } catch (e) {
    console.error('enqueueProfileOptimization error', e?.message || e);
  }
}
