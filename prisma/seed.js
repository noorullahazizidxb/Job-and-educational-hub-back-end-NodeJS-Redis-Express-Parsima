import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

async function main() {
  // Ensure uploads dir and copy sample PDFs for testing
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const sourceCv = path.resolve(process.cwd(), 'cv.pdf');
  const sourceCover = path.resolve(process.cwd(), 'coverletter.pdf');
  const destCv = path.join(uploadsDir, 'cv.pdf');
  const destCover = path.join(uploadsDir, 'coverletter.pdf');
  try { if (fs.existsSync(sourceCv) && !fs.existsSync(destCv)) fs.copyFileSync(sourceCv, destCv); } catch {}
  try { if (fs.existsSync(sourceCover) && !fs.existsSync(destCover)) fs.copyFileSync(sourceCover, destCover); } catch {}
  // Cities
  const citiesData = [
    { name: 'Kabul', province: 'Kabul', country: 'Afghanistan' },
    { name: 'Herat', province: 'Herat', country: 'Afghanistan' },
    { name: 'Mazar-i-Sharif', province: 'Balkh', country: 'Afghanistan' },
    { name: 'Kandahar', province: 'Kandahar', country: 'Afghanistan' },
    { name: 'Jalalabad', province: 'Nangarhar', country: 'Afghanistan' },
    { name: 'Kunduz', province: 'Kunduz', country: 'Afghanistan' },
    { name: 'Ghazni', province: 'Ghazni', country: 'Afghanistan' },
    { name: 'Bamyan', province: 'Bamyan', country: 'Afghanistan' },
    { name: 'Maimana', province: 'Faryab', country: 'Afghanistan' },
    { name: 'Sheberghan', province: 'Jowzjan', country: 'Afghanistan' },
  ];
  for (const c of citiesData) {
    const existing = await prisma.city.findFirst({ where: { name: c.name, country: c.country } });
    if (existing) {
      await prisma.city.update({ where: { id: existing.id }, data: c });
    } else {
      await prisma.city.create({ data: c });
    }
  }

  // Categories (ensure at least 10)
  const categories = ['Engineering', 'Design', 'Marketing', 'Finance', 'HR', 'Sales', 'Operations', 'Support', 'Legal', 'IT'];
  for (const name of categories) {
    const slug = toSlug(name);
    await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
  }

  // Get categories map (slug -> id)
  const categoryRows = await prisma.category.findMany();
  const categoryBySlug = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));

  // Admin user
  const adminEmail = 'admin@example.com';
  const adminPass = 'password123';
  const adminHash = await bcrypt.hash(adminPass, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin' },
    create: { email: adminEmail, passwordHash: adminHash, role: 'admin', name: 'Site Admin' },
  });

  // Default theme setting (only create if missing to avoid overwriting user changes)
  const existingTheme = await prisma.setting.findUnique({ where: { key: 'theme' } });
  if (!existingTheme) {
  await prisma.setting.create({
      data: {
        key: 'theme',
        value: null,
        json: {
          light: {
            primary: '#3b82f6',
            accent: '#8b5cf6',
            secondary: '#a50000ff',
            background: '#ffffff',
            surface: '#f8fafc',
            muted: '#e5e7eb',
            text: '#0f172a',
            border: '#e2e8f0',
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#ef4444',
          },
          dark: {
            primary: '#60a5fa',
            accent: '#a78bfa',
            secondary: '#a50000ff',
            background: '#0b1220',
            surface: '#111827',
            muted: '#374151',
            text: '#e5e7eb',
            border: '#1f2937',
            success: '#4ade80',
            warning: '#fbbf24',
            danger: '#f87171',
          },
          tokens: {
            radius: { button: 6, input: 6, card: 10 },
            spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
            shadow: {
              sm: '0 1px 2px rgba(0,0,0,0.05)',
              md: '0 4px 6px rgba(0,0,0,0.1)',
              lg: '0 10px 15px rgba(0,0,0,0.15)',
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
      },
    });
  }

  // Companies + company users (ensure at least 10 companies)
  const company = await prisma.company.upsert({
    where: { slug: 'acme-corp' },
    update: { name: 'Acme Corp', logoUrl: 'https://www.acbar.org/Website/images/logo.png' },
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      website: 'https://acme.example.com',
      logoUrl: 'https://www.acbar.org/Website/images/logo.png',
      industry: 'Technology',
      size: '51-200',
      about: 'We build awesome stuff.',
      description: 'Longer description about Acme.',
      address: '123 Main St',
    },
  });

  const moreCompanies = [
    'Globex Corporation','Initech','Umbrella Corp','Stark Industries','Wayne Enterprises',
    'Hooli','Soylent Corp','Cyberdyne Systems','Wonka Industries'
  ];
  const companies = [company];
  for (const name of moreCompanies) {
    const slug = toSlug(name);
    const c = await prisma.company.upsert({
      where: { slug },
      update: { name, logoUrl: 'https://www.acbar.org/Website/images/logo.png' },
      create: {
        name,
        slug,
        website: `https://${slug}.example.com`,
        logoUrl: 'https://www.acbar.org/Website/images/logo.png',
        industry: 'Technology',
        size: '11-50',
        about: `${name} about`,
        description: `${name} description`,
        address: 'Some Street',
      },
    });
    companies.push(c);
  }

  const companyEmail = 'company@example.com';
  const companyHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: companyEmail },
    update: { role: 'company', companyId: company.id },
    create: { email: companyEmail, passwordHash: companyHash, role: 'company', name: 'Acme HR', companyId: company.id },
  });
  // Additional company users for the other companies
  let idxCompany = 1;
  for (let i = 1; i < companies.length; i++) {
    const c = companies[i];
    const email = `company${i}@example.com`;
    const hash = await bcrypt.hash('password123', 10);
    await prisma.user.upsert({
      where: { email },
      update: { role: 'company', companyId: c.id },
      create: { email, passwordHash: hash, role: 'company', name: `HR ${c.name}`, companyId: c.id },
    });
    idxCompany++;
  }

  // Add common users to reach at least 10 users total
  for (let i = 1; i <= 8; i++) {
    const email = `user${i}@example.com`;
    const hash = await bcrypt.hash('password123', 10);
    await prisma.user.upsert({
      where: { email },
      update: { name: `User ${i}` },
      create: { email, passwordHash: hash, role: 'common', name: `User ${i}` },
    });
  }

  // Resolve cities for referencing in jobs
  const cityKabul = await prisma.city.findFirst({ where: { name: 'Kabul' } });
  const cityHerat = await prisma.city.findFirst({ where: { name: 'Herat' } });
  const cityMazar = await prisma.city.findFirst({ where: { name: 'Mazar-i-Sharif' } });

  // A sample job (complete attributes)
  const job = await prisma.job.upsert({
    where: { slug: 'frontend-developer-acme' },
    update: {
      title: 'Frontend Developer',
      type: 'full_time',
      location: 'Kabul',
      salaryMin: 800,
      salaryMax: 2000,
      currency: 'USD',
      description: 'Build and ship UI for our core product using React and Tailwind.',
      skills: 'React, TypeScript, Tailwind, REST',
      benefits: 'Health Insurance,Paid Time Off,Remote Work',
      applyEmail: 'careers@acme.example.com',
      contactEmail: 'hr@acme.example.com',
      closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      vacancies: 2,
      experience: 'mid',
      education: 'bachelor',
      gender: 'any',
      orgType: 'private',
      status: 'published',
      featured: true,
      featuredUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  cityId: cityKabul?.id || null,
    },
    create: {
      slug: 'frontend-developer-acme',
      title: 'Frontend Developer',
      type: 'full_time',
      location: 'Kabul',
      salaryMin: 800,
      salaryMax: 2000,
      currency: 'USD',
      description: 'Build and ship UI for our core product using React and Tailwind.',
      skills: 'React, TypeScript, Tailwind, REST',
      benefits: 'Health Insurance,Paid Time Off,Remote Work',
      applyEmail: 'careers@acme.example.com',
      contactEmail: 'hr@acme.example.com',
      postedAt: new Date(),
      closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      vacancies: 2,
      experience: 'mid',
      education: 'bachelor',
      gender: 'any',
      orgType: 'private',
      status: 'published',
      featured: true,
      featuredUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      cityId: cityKabul?.id || null,
      companyId: company.id,
    },
  });

  // Ensure primary job has many-to-many categories (e.g., Engineering, IT)
  if (job) {
    const desiredCats = ['engineering', 'it'];
    const desiredIds = desiredCats.map((s) => categoryBySlug[s]).filter(Boolean);
    for (const cid of desiredIds) {
      await prisma.jobCategory.upsert({
        where: { jobId_categoryId: { jobId: job.id, categoryId: cid } },
        update: {},
        create: { jobId: job.id, categoryId: cid },
      });
    }
  }

  // Create 10 additional complete jobs for testing (distributed across companies)
  const jobTypes = ['full_time', 'part_time', 'contract', 'internship', 'temporary', 'remote'];
  const experiences = ['entry', 'mid', 'senior', 'lead'];
  const educations = ['diploma', 'bachelor', 'master'];
  const cities = [cityKabul, cityHerat, cityMazar].filter(Boolean);
  const categorySlugs = Object.keys(categoryBySlug);

  for (let i = 1; i <= 10; i++) {
    const title = `Seed Job ${i}`;
    const slug = toSlug(`${title}-acme`);
    const type = jobTypes[i % jobTypes.length];
    const exp = experiences[i % experiences.length];
    const edu = educations[i % educations.length];
    const city = cities[i % cities.length];
    const location = city?.name || 'Kabul';
  const catSlug = categorySlugs[i % categorySlugs.length];
  const catId = categoryBySlug[catSlug];
    const postedAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const featured = i % 3 === 0;
    const featuredUntil = featured ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

  const created = await prisma.job.upsert({
      where: { slug },
      update: {
        title,
        type,
        location,
        salaryMin: 400 + i * 50,
        salaryMax: 1000 + i * 80,
        currency: 'USD',
        description: `Comprehensive seeded job ${i} for testing all attributes and listings.`,
        skills: 'JavaScript,Node.js,SQL,Docker',
        benefits: 'Health Insurance,Paid Time Off,Annual Bonus,Remote Work',
        applyUrl: `https://acme.example.com/jobs/${slug}`,
        contactEmail: 'hr@acme.example.com',
        postedAt,
        closingDate: new Date(Date.now() + (20 + i) * 24 * 60 * 60 * 1000),
        vacancies: (i % 4) + 1,
        experience: exp,
        education: edu,
        gender: 'any',
        orgType: 'private',
        status: 'published',
        featured,
        featuredUntil,
        cityId: city?.id || null,
  companyId: companies[i % companies.length].id,
      },
      create: {
        slug,
        title,
        type,
        location,
        salaryMin: 400 + i * 50,
        salaryMax: 1000 + i * 80,
        currency: 'USD',
        description: `Comprehensive seeded job ${i} for testing all attributes and listings.`,
        skills: 'JavaScript,Node.js,SQL,Docker',
        benefits: 'Health Insurance,Paid Time Off,Annual Bonus,Remote Work',
        applyUrl: `https://acme.example.com/jobs/${slug}`,
        contactEmail: 'hr@acme.example.com',
        postedAt,
        closingDate: new Date(Date.now() + (20 + i) * 24 * 60 * 60 * 1000),
        vacancies: (i % 4) + 1,
        experience: exp,
        education: edu,
        gender: 'any',
        orgType: 'private',
        status: 'published',
        featured,
        featuredUntil,
        cityId: city?.id || null,
  companyId: companies[i % companies.length].id,
      },
    });

    // Attach 1-3 categories per job via many-to-many
    const howMany = (i % 3) + 1;
    const shuffled = [...categorySlugs].sort(() => 0.5 - Math.random()).slice(0, howMany);
    for (const s of shuffled) {
      const cId = categoryBySlug[s];
      if (!cId) continue;
      await prisma.jobCategory.upsert({
        where: { jobId_categoryId: { jobId: created.id, categoryId: cId } },
        update: {},
        create: { jobId: created.id, categoryId: cId },
      });
    }
  }

  // Seed job reviews (ensure at least 10)
  const jobsForReviews = await prisma.job.findMany({ take: 10, orderBy: { id: 'asc' } });
  const users = await prisma.user.findMany({ where: { role: 'common' }, take: 10 });
  let ratingBase = 3;
  // Create at least 10 job reviews. Since unique(jobId,userId) was removed, create new reviews freely.
  let totalReviews = 0;
  for (const j of jobsForReviews) {
    // create between 1 and 3 reviews per job depending on users available
    const howMany = Math.min(3, Math.max(1, Math.floor(Math.random() * 3) + 1));
    for (let u = 0; u < howMany && u < users.length; u++) {
      const user = users[u];
      try {
        await prisma.jobReview.create({
          data: { jobId: j.id, userId: user.id, rating: ((ratingBase + u) % 5) + 1, comment: `Seeded review ${u + 1} for job ${j.slug}` },
        });
        totalReviews++;
      } catch (err) {
        // ignore individual failures
      }
    }
    ratingBase++;
  }

  // If for some reason we created fewer than 10 reviews, add more using random jobs/users
  if (totalReviews < 10) {
    const allJobs = await prisma.job.findMany({ take: 50 });
    const allUsers = await prisma.user.findMany({ take: 50 });
    while (totalReviews < 10 && allJobs.length && allUsers.length) {
      const j = allJobs[Math.floor(Math.random() * allJobs.length)];
      const u = allUsers[Math.floor(Math.random() * allUsers.length)];
      try {
        await prisma.jobReview.create({ data: { jobId: j.id, userId: u.id, rating: (Math.floor(Math.random() * 5) + 1), comment: `Extra seeded review for job ${j.slug}` } });
        totalReviews++;
      } catch {}
    }
  }

  // Seed Notifications (ensure at least 10 notifications and recipients)
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  const allUserRows = await prisma.user.findMany({ take: 20 });
  const allCompanyRows = await prisma.company.findMany({ take: 20 });
  for (let n = 1; n <= 10; n++) {
    try {
      const notif = await prisma.notification.create({
        data: {
          title: `Seed Notification ${n}`,
          body: `This is seeded notification number ${n}`,
          link: n % 2 === 0 ? `https://example.com/notice/${n}` : null,
          createdById: adminUser?.id || null,
          targetAll: false,
          targetRole: null,
        },
      });
      // create 1-3 recipients per notification (mix users and companies)
      const recipCount = 1 + (n % 3);
      for (let r = 0; r < recipCount; r++) {
        if (r % 2 === 0 && allUserRows[r]) {
          await prisma.notificationRecipient.create({ data: { notificationId: notif.id, userId: allUserRows[r].id } });
        } else if (allCompanyRows[r]) {
          await prisma.notificationRecipient.create({ data: { notificationId: notif.id, companyId: allCompanyRows[r].id } });
        }
      }
    } catch (err) {
      // ignore
    }
  }

  // Seed at least 10 services
  const service = await prisma.service.upsert({
    where: { slug: 'acme-scholarship-2025' },
    update: { title: 'Acme Scholarship 2025' },
    create: {
      type: 'scholarship',
      title: 'Acme Scholarship 2025',
      slug: 'acme-scholarship-2025',
      description: 'Scholarship details...',
      organization: 'Acme Foundation',
      companyId: company.id,
      country: 'Afghanistan',
      category: 'STEM',
      tags: 'scholarship,education',
      eligibility: 'Undergrad',
      status: 'published',
    },
  });

  // Additional services
  for (let i = 1; i <= 9; i++) {
    const sSlug = `acme-scholarship-2025-${i}`;
    await prisma.service.upsert({
      where: { slug: sSlug },
      update: { title: `Acme Scholarship 2025 #${i}` },
      create: {
        type: i % 2 === 0 ? 'procurement' : 'scholarship',
        title: `Acme ${i % 2 === 0 ? 'Procurement' : 'Scholarship'} ${2025}`,
        slug: sSlug,
        description: 'Seeded service for testing.',
        organization: 'Acme Foundation',
        companyId: company.id,
        country: 'Afghanistan',
        category: i % 2 === 0 ? 'IT' : 'Education',
        tags: 'seed,test',
        eligibility: 'Open',
        status: 'published',
      },
    });
  }

  // Seed at least 10 advertisements
  await prisma.advertisement.upsert({
    where: { id: 1 },
    update: { title: 'Homepage Hero Banner' },
    create: {
      title: 'Homepage Hero Banner',
      placement: 'homepage_hero',
      imageUrl: 'https://picsum.photos/1200/400',
      targetUrl: 'https://example.com',
      isActive: true,
      priority: 10,
    },
  });
  for (let i = 2; i <= 10; i++) {
    await prisma.advertisement.upsert({
      where: { id: i },
      update: { title: `Ad ${i}` },
      create: {
        title: `Ad ${i}`,
        placement: i % 2 === 0 ? 'homepage_sidebar' : 'job_list_top',
        imageUrl: `https://picsum.photos/seed/${i}/600/200`,
        targetUrl: 'https://example.com',
        isActive: i % 3 !== 0,
        priority: i,
      },
    });
  }

  // Seed sample applications referencing uploaded PDFs (idempotent)
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (admin && job) {
    await prisma.jobApplication.upsert({
      where: { jobId_userId: { jobId: job.id, userId: admin.id } },
      update: { cvUrl: fs.existsSync(destCv) ? '/uploads/cv.pdf' : null, coverLetter: fs.existsSync(destCover) ? '/uploads/coverletter.pdf' : null },
      create: {
        jobId: job.id,
        userId: admin.id,
        fullName: 'Seeded Admin',
        email: adminEmail,
        cvUrl: fs.existsSync(destCv) ? '/uploads/cv.pdf' : null,
        coverLetter: fs.existsSync(destCover) ? '/uploads/coverletter.pdf' : null,
        status: 'applied',
      },
    });
  }
  // Additional job applications for coverage (10 total)
  if (admin) {
    const jobs = await prisma.job.findMany({ take: 10, orderBy: { id: 'asc' } });
    let idx = 0;
    for (const j of jobs) {
      await prisma.jobApplication.upsert({
        where: { jobId_userId: { jobId: j.id, userId: admin.id } },
        update: {},
        create: {
          jobId: j.id,
          userId: admin.id,
          fullName: `Admin Applicant ${++idx}`,
          email: adminEmail,
          status: 'applied',
        },
      });
    }
  }
  if (admin && service) {
    await prisma.serviceApplication.upsert({
      where: { serviceId_userId: { serviceId: service.id, userId: admin.id } },
      update: { cvUrl: fs.existsSync(destCv) ? '/uploads/cv.pdf' : null, coverLetter: fs.existsSync(destCover) ? '/uploads/coverletter.pdf' : null },
      create: {
        serviceId: service.id,
        userId: admin.id,
        fullName: 'Seeded Admin',
        email: adminEmail,
        cvUrl: fs.existsSync(destCv) ? '/uploads/cv.pdf' : null,
        coverLetter: fs.existsSync(destCover) ? '/uploads/coverletter.pdf' : null,
        status: 'applied',
      },
    });
  }
  // Additional service applications (ensure ~10)
  if (admin) {
    const services = await prisma.service.findMany({ take: 10, orderBy: { id: 'asc' } });
    let idx = 0;
    for (const s of services) {
      await prisma.serviceApplication.upsert({
        where: { serviceId_userId: { serviceId: s.id, userId: admin.id } },
        update: {},
        create: {
          serviceId: s.id,
          userId: admin.id,
          fullName: `Admin Applicant S${++idx}`,
          email: adminEmail,
          status: 'applied',
        },
      });
    }
  }
}

main()
  .then(async () => {
    console.log('Seed complete');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
