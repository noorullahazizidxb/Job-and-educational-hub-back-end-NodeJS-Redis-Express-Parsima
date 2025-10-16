import { prisma } from '../lib/prisma.js';
import { reindexAfterCleanup } from '../lib/searchIndexer.js';
import { notifyCompany, notifyUser } from '../lib/notify.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Two-phase cleanup:
// Phase A: ensure expired items are marked closed (status = closed)
// Phase B: permanently delete items that have been expired for more than 15 days

const DAYS = Number(process.env.CLEANUP_AFTER_DAYS || 15);

function daysAgoDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function runCleanup(dryRun = false) {
  // Phase A: mark Jobs and Services past closingDate as closed
  const now = new Date();
  const expiredWhere = { closingDate: { lt: now } };

  // Jobs: mark closed
  const jobsToClose = await prisma.job.findMany({ where: { ...expiredWhere, status: { not: 'closed' } }, select: { id: true, closingDate: true, status: true } });
  if (!dryRun && jobsToClose.length) {
    await prisma.job.updateMany({ where: { id: { in: jobsToClose.map((j) => j.id) } }, data: { status: 'closed' } });
  }

  // Services: mark closed
  const servicesToClose = await prisma.service.findMany({ where: { ...expiredWhere, status: { not: 'closed' } }, select: { id: true } });
  if (!dryRun && servicesToClose.length) {
    await prisma.service.updateMany({ where: { id: { in: servicesToClose.map((s) => s.id) } }, data: { status: 'closed' } });
  }

  // Phase B: delete items whose closingDate is older than DAYS
  const cutoff = daysAgoDate(DAYS);

  // Delete JobApplications for jobs that closed before cutoff
  const jobsToArchive = await prisma.job.findMany({ where: { closingDate: { lt: cutoff } }, select: { id: true, title: true, companyId: true } });
  const jobIdsToDelete = jobsToArchive.map((j) => j.id);
  let deletedJobAppIds = [];
  if (jobIdsToDelete.length) {
    // collect and remove CV and cover letter files referenced by job applications
  const jobApps = await prisma.jobApplication.findMany({ where: { jobId: { in: jobIdsToDelete } }, select: { id: true, cvUrl: true, coverLetter: true, userId: true, job: { select: { title: true } } } });
  deletedJobAppIds = jobApps.map(a => a.id);
    const jobAppCvFiles = jobApps.map((a) => a.cvUrl).filter(Boolean);
    const jobAppCoverFiles = jobApps.map((a) => a.coverLetter).filter(Boolean);
    let deletedJobAppCvCount = 0;
    let deletedJobAppCoverCount = 0;
    for (const f of jobAppCvFiles) {
      try {
        const p = String(f);
        if (/^https?:\/\//i.test(p)) continue; // external URL
        const abs = path.resolve(process.cwd(), p.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
          if (!dryRun) fs.unlinkSync(abs);
          deletedJobAppCvCount++;
        }
      } catch (e) {
        console.error('failed deleting job application cv file', f, e?.message || e);
      }
    }
    for (const f of jobAppCoverFiles) {
      try {
        const p = String(f);
        if (/^https?:\/\//i.test(p)) continue; // external URL
        const abs = path.resolve(process.cwd(), p.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
          if (!dryRun) fs.unlinkSync(abs);
          deletedJobAppCoverCount++;
        }
      } catch (e) {
        console.error('failed deleting job application cover file', f, e?.message || e);
      }
    }
  if (!dryRun) await prisma.jobApplication.deleteMany({ where: { jobId: { in: jobIdsToDelete } } });
    // delete job reviews and job-category relations to avoid FK constraints
    let deletedJobReviews = 0;
    let deletedJobCategories = 0;
    try {
      if (!dryRun) {
        const r1 = await prisma.jobReview.deleteMany({ where: { jobId: { in: jobIdsToDelete } } });
        deletedJobReviews = r1.count ?? r1;
        const r2 = await prisma.jobCategory.deleteMany({ where: { jobId: { in: jobIdsToDelete } } });
        deletedJobCategories = r2.count ?? r2;
      } else {
        // in dryRun try to compute counts without deleting
        deletedJobReviews = await prisma.jobReview.count({ where: { jobId: { in: jobIdsToDelete } } }).catch(() => 0);
        deletedJobCategories = await prisma.jobCategory.count({ where: { jobId: { in: jobIdsToDelete } } }).catch(() => 0);
      }
    } catch (e) {
      console.error('failed removing job reviews/categories', e?.message || e);
    }
  }

  // Delete Services' applications for services closed before cutoff
  const servicesToArchive = await prisma.service.findMany({ where: { closingDate: { lt: cutoff } }, select: { id: true, title: true, companyId: true } });
  const serviceIdsToDelete = servicesToArchive.map((s) => s.id);
  let deletedServiceAppIds = [];
  if (serviceIdsToDelete.length) {
    // collect and remove CV files referenced by service applications
  const svcApps = await prisma.serviceApplication.findMany({ where: { serviceId: { in: serviceIdsToDelete } }, select: { id: true, cvUrl: true, coverLetter: true, userId: true, service: { select: { title: true } } } });
  deletedServiceAppIds = svcApps.map(a => a.id);
    const svcAppFiles = svcApps.map((a) => a.cvUrl).filter(Boolean);
    let deletedSvcFilesCount = 0;
    let deletedSvcCoverFilesCount = 0;
    for (const f of svcAppFiles) {
      try {
        const p = String(f);
        if (/^https?:\/\//i.test(p)) continue;
        const abs = path.resolve(process.cwd(), p.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
          if (!dryRun) fs.unlinkSync(abs);
          deletedSvcFilesCount++;
        }
      } catch (e) {
        console.error('failed deleting service application file', f, e?.message || e);
      }
    }
    // delete coverLetters from service applications if present
    const svcCoverFiles = svcApps.map((a) => a.coverLetter).filter(Boolean);
    for (const f of svcCoverFiles) {
      try {
        const p = String(f);
        if (/^https?:\/\//i.test(p)) continue;
        const abs = path.resolve(process.cwd(), p.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
          if (!dryRun) fs.unlinkSync(abs);
          deletedSvcCoverFilesCount++;
        }
      } catch (e) {
        console.error('failed deleting service application cover file', f, e?.message || e);
      }
    }
    // collect service documents (JSON) that may reference uploaded files
    const servicesWithDocs = await prisma.service.findMany({ where: { id: { in: serviceIdsToDelete } }, select: { id: true, documents: true } });
    let deletedServiceDocFiles = 0;
    for (const s of servicesWithDocs) {
      const docs = s.documents;
      if (!docs) continue;
      // documents may be an array or object containing paths
      const candidates = [];
      if (Array.isArray(docs)) {
        for (const item of docs) if (typeof item === 'string') candidates.push(item);
      } else if (typeof docs === 'string') {
        candidates.push(docs);
      } else if (typeof docs === 'object') {
        const gather = (obj) => {
          for (const v of Object.values(obj)) {
            if (!v) continue;
            if (typeof v === 'string') candidates.push(v);
            else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') candidates.push(x);
            else if (typeof v === 'object') gather(v);
          }
        };
        gather(docs);
      }
      for (const f of candidates) {
        try {
          const p = String(f);
          if (/^https?:\/\//i.test(p)) continue;
          const abs = path.resolve(process.cwd(), p.replace(/^\//, ''));
          if (fs.existsSync(abs)) {
            if (!dryRun) fs.unlinkSync(abs);
            deletedServiceDocFiles++;
          }
        } catch (e) {
          console.error('failed deleting service document file', f, e?.message || e);
        }
      }
    }
  if (!dryRun) await prisma.serviceApplication.deleteMany({ where: { serviceId: { in: serviceIdsToDelete } } });
  }

  // Delete jobs themselves
  if (jobIdsToDelete.length) {
    if (!dryRun) await prisma.job.deleteMany({ where: { id: { in: jobIdsToDelete } } });
  }

  // Delete services themselves
  if (serviceIdsToDelete.length) {
    if (!dryRun) await prisma.service.deleteMany({ where: { id: { in: serviceIdsToDelete } } });
  }

  // Companies are excluded from automatic deletion — nothing to do here

  const result = {
    closedJobs: jobsToClose.length,
    closedServices: servicesToClose.length,
    deletedJobApplications: deletedJobAppIds.length,
    deletedServiceApplications: deletedServiceAppIds.length,
    deletedJobs: jobIdsToDelete.length,
    deletedServices: serviceIdsToDelete.length,
    deletedCompanies: 0, // returned for compatibility; calculated above if needed
    // file deletion counters (approx)
    deletedFiles: {
      jobApplicationCvs: typeof deletedJobAppCvCount === 'number' ? deletedJobAppCvCount : 0,
      jobApplicationCoverLetters: typeof deletedJobAppCoverCount === 'number' ? deletedJobAppCoverCount : 0,
      serviceApplicationCvs: typeof deletedSvcFilesCount === 'number' ? deletedSvcFilesCount : 0,
      serviceApplicationCoverLetters: typeof deletedSvcCoverFilesCount === 'number' ? deletedSvcCoverFilesCount : 0,
      serviceDocuments: typeof deletedServiceDocFiles === 'number' ? deletedServiceDocFiles : 0,
      companyLogos: 0,
    }
  };

  // Trigger ES reindex deletions and refresh
  try {
    await reindexAfterCleanup({
      deletedJobs: jobIdsToDelete,
      deletedServices: serviceIdsToDelete,
      deletedJobApplications: deletedJobAppIds,
      deletedServiceApplications: deletedServiceAppIds,
    });
  } catch (e) {
    console.error('search reindexAfterCleanup failed', e?.message || e);
  }

  // Notify impacted companies and users about deletions (best-effort; non-blocking)
  try {
    if (!dryRun) {
      if (jobIdsToDelete.length) {
        for (const j of jobsToArchive) {
          if (j.companyId) try { await notifyCompany({ title: 'Job archived', body: `${j.title} has been archived after expiration.`, companyId: j.companyId }); } catch {}
        }
      }
      if (serviceIdsToDelete.length) {
        for (const s of servicesToArchive) {
          if (s.companyId) try { await notifyCompany({ title: 'Service archived', body: `${s.title} has been archived after expiration.`, companyId: s.companyId }); } catch {}
        }
      }
      if (deletedJobAppIds.length) {
        for (const a of jobApps) {
          try { await notifyUser({ title: 'Application archived', body: `Your application for ${a.job?.title || 'a job'} has been archived after expiration.`, userId: a.userId }); } catch {}
        }
      }
      if (deletedServiceAppIds.length) {
        for (const a of svcApps) {
          try { await notifyUser({ title: 'Application archived', body: `Your application for ${a.service?.title || 'a service'} has been archived after expiration.`, userId: a.userId }); } catch {}
        }
      }
    }
  } catch (e) {
    console.error('cleanup notification emission failed', e?.message || e);
  }

  return result;
}

// If run directly, execute once (dryRun=false) and exit
if (process.argv[1] && process.argv[1].endsWith(path.basename(fileURLToPath(import.meta.url)))) {
  (async () => {
    const envDry = String(process.env.CLEANUP_DRY_RUN || '').toLowerCase();
    const dryRun = envDry === '1' || envDry === 'true' || envDry === 'yes';
    console.log('Starting daily cleanup (dryRun=' + dryRun + ')');
    try {
      const r = await runCleanup(dryRun);
      console.log('Cleanup result:', r);
    } catch (e) {
      console.error('Cleanup failed', e?.message || e);
      process.exitCode = 2;
    } finally {
      await prisma.$disconnect();
      process.exit(0);
    }
  })();
}

export default runCleanup;
