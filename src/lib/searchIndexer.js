import { prisma } from './prisma.js';
import { getEsClient, isSearchEnabled, refreshIndices } from './elasticsearch.js';
import logger from '../utils/logger.js';

export const INDEX = {
  companies: 'companies',
  jobs: 'jobs',
  services: 'services',
  users: 'users',
  applications: 'applications', // both job + service applications with type field
};

async function ensureIndex(client, index, mappings) {
  try {
    const exists = await client.indices.exists({ index });
    if (!exists) {
      await client.indices.create({ index, mappings, settings: { number_of_shards: 1, number_of_replicas: 0 } });
    }
  } catch (e) {
    // in ES v9 client, exists returns boolean not {body}; handle both
    try {
      if (!(await client.indices.exists({ index }))) {
        await client.indices.create({ index, mappings, settings: { number_of_shards: 1, number_of_replicas: 0 } });
      }
    } catch (err) {
      logger.warn(`ensureIndex(${index}) failed: ${err?.message || err}`);
    }
  }
}

export async function setupIndices() {
  if (!isSearchEnabled()) return;
  const client = await getEsClient();
  const text = (fields) => ({
    properties: fields.reduce((acc, f) => ({ ...acc, [f]: { type: 'text' } }), {})
  });
  await ensureIndex(client, INDEX.companies, {
    properties: {
      id: { type: 'integer' },
      name: { type: 'text' },
      slug: { type: 'keyword' },
      industry: { type: 'text' },
      size: { type: 'keyword' },
      about: { type: 'text' },
      description: { type: 'text' },
      cityId: { type: 'integer' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    }
  });
  await ensureIndex(client, INDEX.jobs, {
    properties: {
      id: { type: 'integer' },
      slug: { type: 'keyword' },
      title: { type: 'text' },
      type: { type: 'keyword' },
      location: { type: 'text' },
      description: { type: 'text' },
      skills: { type: 'text' },
      benefits: { type: 'text' },
      status: { type: 'keyword' },
      companyId: { type: 'integer' },
      cityId: { type: 'integer' },
      postedAt: { type: 'date' },
      closingDate: { type: 'date' },
    }
  });
  await ensureIndex(client, INDEX.services, {
    properties: {
      id: { type: 'integer' },
      slug: { type: 'keyword' },
      title: { type: 'text' },
      type: { type: 'keyword' },
      description: { type: 'text' },
      organization: { type: 'text' },
      companyId: { type: 'integer' },
      cityId: { type: 'integer' },
      category: { type: 'keyword' },
      tags: { type: 'text' },
      status: { type: 'keyword' },
      postedAt: { type: 'date' },
      closingDate: { type: 'date' },
    }
  });
  await ensureIndex(client, INDEX.users, {
    properties: {
      id: { type: 'integer' },
      email: { type: 'keyword' },
      name: { type: 'text' },
      role: { type: 'keyword' },
      companyId: { type: 'integer' },
      skills: { type: 'text' },
      about: { type: 'text' },
      createdAt: { type: 'date' },
    }
  });
  await ensureIndex(client, INDEX.applications, {
    properties: {
      id: { type: 'integer' },
      type: { type: 'keyword' }, // 'job' | 'service'
      jobId: { type: 'integer' },
      serviceId: { type: 'integer' },
      userId: { type: 'integer' },
      fullName: { type: 'text' },
      email: { type: 'keyword' },
      status: { type: 'keyword' },
      createdAt: { type: 'date' },
    }
  });
}

function mapCompany(c) { return { id: c.id, name: c.name, slug: c.slug, industry: c.industry, size: c.size, about: c.about, description: c.description, cityId: c.cityId, createdAt: c.createdAt, updatedAt: c.updatedAt }; }
function mapJob(j) { return { id: j.id, slug: j.slug, title: j.title, type: j.type, location: j.location, description: j.description, skills: j.skills, benefits: j.benefits, status: j.status, companyId: j.companyId, cityId: j.cityId, postedAt: j.postedAt, closingDate: j.closingDate }; }
function mapService(s) { return { id: s.id, slug: s.slug, title: s.title, type: s.type, description: s.description, organization: s.organization, companyId: s.companyId, cityId: s.cityId, category: s.category, tags: s.tags, status: s.status, postedAt: s.postedAt, closingDate: s.closingDate }; }
function mapUser(u) { return { id: u.id, email: u.email, name: u.name, role: u.role, companyId: u.companyId, skills: u.skills, about: u.about, createdAt: u.createdAt }; }
function mapJobApp(a) { return { id: a.id, type: 'job', jobId: a.jobId, userId: a.userId, fullName: a.fullName, email: a.email, status: a.status, createdAt: a.createdAt }; }
function mapServiceApp(a) { return { id: a.id, type: 'service', serviceId: a.serviceId, userId: a.userId, fullName: a.fullName, email: a.email, status: a.status, createdAt: a.createdAt }; }

async function bulkIndex(index, docs, idField = 'id') {
  if (!docs?.length) return;
  const client = await getEsClient();
  if (!client) return;
  const ops = [];
  for (const d of docs) {
    let _id = d[idField];
    if (index === INDEX.applications && d.type && d.id != null) {
      _id = `${d.type}:${d.id}`; // prevent job/service application ID collision
    }
    ops.push({ index: { _index: index, _id } });
    ops.push(d);
  }
  await client.bulk({ refresh: true, operations: ops });
}

async function bulkDelete(index, ids, opts = {}) {
  if (!ids?.length) return;
  const client = await getEsClient();
  if (!client) return;
  const ops = [];
  for (const id of ids) {
    const _id = index === INDEX.applications && opts.type ? `${opts.type}:${id}` : id;
    ops.push({ delete: { _index: index, _id } });
  }
  await client.bulk({ refresh: true, operations: ops });
}

export async function indexCompanyById(id) {
  if (!isSearchEnabled()) return;
  const c = await prisma.company.findUnique({ where: { id: Number(id) } });
  if (!c) return deleteFromIndex(INDEX.companies, id);
  return bulkIndex(INDEX.companies, [mapCompany(c)]);
}
export async function deleteFromIndex(index, id) { return bulkDelete(index, [id]); }

export async function indexJobById(id) {
  if (!isSearchEnabled()) return;
  const j = await prisma.job.findUnique({ where: { id: Number(id) } });
  if (!j) return deleteFromIndex(INDEX.jobs, id);
  return bulkIndex(INDEX.jobs, [mapJob(j)]);
}

export async function indexServiceById(id) {
  if (!isSearchEnabled()) return;
  const s = await prisma.service.findUnique({ where: { id: Number(id) } });
  if (!s) return deleteFromIndex(INDEX.services, id);
  return bulkIndex(INDEX.services, [mapService(s)]);
}

export async function indexUserById(id) {
  if (!isSearchEnabled()) return;
  const u = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!u) return deleteFromIndex(INDEX.users, id);
  return bulkIndex(INDEX.users, [mapUser(u)]);
}

export async function indexJobApplicationById(id) {
  if (!isSearchEnabled()) return;
  const a = await prisma.jobApplication.findUnique({ where: { id: Number(id) } });
  if (!a) return deleteFromIndex(INDEX.applications, id);
  return bulkIndex(INDEX.applications, [mapJobApp(a)]);
}

export async function indexServiceApplicationById(id) {
  if (!isSearchEnabled()) return;
  const a = await prisma.serviceApplication.findUnique({ where: { id: Number(id) } });
  if (!a) return deleteFromIndex(INDEX.applications, id);
  return bulkIndex(INDEX.applications, [mapServiceApp(a)]);
}

export async function backfillAllIndices() {
  if (!isSearchEnabled()) return { enabled: false };
  const client = await getEsClient();
  await setupIndices();
  const [companies, jobs, services, users, jobApps, svcApps] = await Promise.all([
    prisma.company.findMany(),
    prisma.job.findMany(),
    prisma.service.findMany(),
    prisma.user.findMany(),
    prisma.jobApplication.findMany(),
    prisma.serviceApplication.findMany(),
  ]);
  await bulkIndex(INDEX.companies, companies.map(mapCompany));
  await bulkIndex(INDEX.jobs, jobs.map(mapJob));
  await bulkIndex(INDEX.services, services.map(mapService));
  await bulkIndex(INDEX.users, users.map(mapUser));
  await bulkIndex(INDEX.applications, jobApps.map(mapJobApp).concat(svcApps.map(mapServiceApp)));
  await refreshIndices(Object.values(INDEX));
  return { enabled: true, counts: { companies: companies.length, jobs: jobs.length, services: services.length, users: users.length, applications: jobApps.length + svcApps.length } };
}

// During cleanup reindex: remove deleted and refresh
export async function reindexAfterCleanup({ deletedJobs = [], deletedServices = [], deletedJobApplications = [], deletedServiceApplications = [] } = {}) {
  if (!isSearchEnabled()) return;
  try {
    if (deletedJobs.length) await bulkDelete(INDEX.jobs, deletedJobs);
    if (deletedServices.length) await bulkDelete(INDEX.services, deletedServices);
    if (deletedJobApplications.length) await bulkDelete(INDEX.applications, deletedJobApplications, { type: 'job' });
    if (deletedServiceApplications.length) await bulkDelete(INDEX.applications, deletedServiceApplications, { type: 'service' });
  } catch (e) {
    logger.warn('reindexAfterCleanup delete failed: ' + (e?.message || e));
  }
  await refreshIndices([INDEX.jobs, INDEX.services, INDEX.applications]);
}
