import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import sharp from 'sharp';
import { createWorker } from '../lib/queue.js';

async function optimizeImage(abs) {
  const tmp = `${abs}.opt`;
  try {
    await sharp(abs)
      .resize({ width: 1024, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(tmp);
    fs.renameSync(tmp, abs);
    return true;
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    console.error('image optimization failed for', abs, e?.message || e);
    return false;
  }
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

async function optimizePdf(abs) {
  // Try common Ghostscript executable names
  const candidates = ['gs', 'gswin64c', 'gswin32c'];
  const tmp = `${abs}.opt.pdf`;
  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=/ebook', // tradeoff between quality and size; choose /screen|/ebook|/printer
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${tmp}`,
    abs,
  ];

  for (const cmd of candidates) {
    try {
      await runCommand(cmd, args);
      // success; replace original
      fs.renameSync(tmp, abs);
      return true;
    } catch (e) {
      // if executable not found, try next
      if (e?.err && e.err.code === 'ENOENT') continue;
      // other errors: log and try next candidate
      console.error('ghostscript failed for', abs, 'with', cmd, e?.stderr || e?.err || e);
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    }
  }

  // none succeeded
  console.warn('ghostscript not available or all candidates failed; skipping PDF optimize for', abs);
  return false;
}

async function processor(job) {
  const { filePath, mime } = job.data;
  if (!filePath) return;
  const abs = path.resolve(process.cwd(), filePath.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return;

  if (mime && mime.startsWith('image/')) {
    await optimizeImage(abs);
  } else if (mime === 'application/pdf') {
    await optimizePdf(abs);
  }
}

function noopDisabledWorker() {
  return { on() {}, close: async () => {} };
}

let workerInstance = null;
export function startWorker(options = {}) {
  if (workerInstance) return workerInstance;
  if (process.env.HOSTING_PLATFORM === 'vercel' || process.env.VERCEL) {
    console.log('image-processor worker skipped on Vercel');
    return noopDisabledWorker();
  }
  const w = createWorker('image-processor', async (job) => processor(job), options);
  w.on('failed', (job, err) => {
    console.error('image-processor job failed', job.id, err?.message || err);
  });
  workerInstance = w;
  return w;
}

// If this module is run directly, start the worker (standalone worker process)
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].endsWith(path.basename(__filename))) {
  console.log('Starting image-processor worker (standalone)');
  const w = startWorker({});
  // graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down image-processor worker');
    try { await w.close(); } catch (e) { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default { startWorker };
