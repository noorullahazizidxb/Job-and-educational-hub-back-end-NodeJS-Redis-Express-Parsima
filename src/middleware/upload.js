import fs from 'fs';
import path from 'path';
import multer from 'multer';

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ensure services subfolder exists
const serviceUploadDir = path.resolve(uploadDir, 'services');
if (!fs.existsSync(serviceUploadDir)) {
  fs.mkdirSync(serviceUploadDir, { recursive: true });
}

// ensure profile subfolder exists
const profileUploadDir = path.resolve(uploadDir, 'profile');
if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = Date.now();
    cb(null, `${ts}_${safeOriginal}`);
  },
});

const serviceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, serviceUploadDir),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = Date.now();
    cb(null, `${ts}_${safeOriginal}`);
  },
});

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileUploadDir),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = Date.now();
    cb(null, `${ts}_${safeOriginal}`);
  },
});

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

const DEFAULT_FILE_LIMIT = Number(process.env.FILE_UPLOAD_LIMIT_BYTES) || 5 * 1024 * 1024; // 5MB default
const DEFAULT_SERVICE_LIMIT = Number(process.env.SERVICE_UPLOAD_LIMIT_BYTES) || 10 * 1024 * 1024; // 10MB default

export const upload = multer({ storage, fileFilter, limits: { fileSize: DEFAULT_FILE_LIMIT } });
export const uploadService = multer({ storage: serviceStorage, fileFilter, limits: { fileSize: DEFAULT_SERVICE_LIMIT } });
export const uploadProfile = multer({
  storage: profileStorage,
  fileFilter: (_req, file, cb) => {
    // Accept common image mime types including some vendor variants
    const allowedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
    if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error('Invalid image type'));
  },
  limits: { fileSize: Number(process.env.PROFILE_UPLOAD_LIMIT_BYTES) || 5 * 1024 * 1024 }, // Limit to 5MB
});
