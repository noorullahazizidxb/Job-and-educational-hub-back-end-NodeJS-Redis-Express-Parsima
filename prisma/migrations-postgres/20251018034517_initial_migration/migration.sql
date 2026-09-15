-- CreateSchema
CREATE TYPE "JobType" AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'temporary', 'remote');
CREATE TYPE "JobStatus" AS ENUM ('draft', 'published', 'closed');
CREATE TYPE "ExperienceLevel" AS ENUM ('entry', 'mid', 'senior', 'lead');
CREATE TYPE "EducationLevel" AS ENUM ('high_school', 'diploma', 'bachelor', 'master', 'doctorate');
CREATE TYPE "Gender" AS ENUM ('any', 'male', 'female');
CREATE TYPE "OrganizationType" AS ENUM ('private', 'government', 'ngo', 'international_org', 'other');
CREATE TYPE "AdPlacement" AS ENUM ('job_list_top', 'middle_of_job_list', 'home_page_after_pagenation_1', 'home_page_after_pagenation_2', 'middle_of_related_jobs_on_job_details', 'company_list_top', 'middle_of_company_list', 'middle_of_related_companies_on_company_details', 'service_list_top', 'middle_of_service_list', 'middle_of_related_services_on_service_details');
CREATE TYPE "ServiceType" AS ENUM ('procurement', 'scholarship');
CREATE TYPE "ServiceStatus" AS ENUM ('draft', 'published', 'closed');
CREATE TYPE "UserRole" AS ENUM ('common', 'company', 'admin', 'employee');
CREATE TYPE "ApplicationStatus" AS ENUM ('applied', 'viewed', 'shortlisted', 'rejected', 'hired', 'withdrawn');

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT,
    "country" TEXT DEFAULT 'Afghanistan',
    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "about" TEXT,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "cityId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "location" TEXT NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" TEXT DEFAULT 'USD',
    "description" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "benefits" TEXT,
    "applyUrl" TEXT,
    "applyEmail" TEXT,
    "contactEmail" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingDate" TIMESTAMP(3),
    "vacancies" INTEGER DEFAULT 1,
    "experience" "ExperienceLevel",
    "education" "EducationLevel",
    "gender" "Gender",
    "orgType" "OrganizationType",
    "status" "JobStatus" NOT NULL DEFAULT 'published',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "cityId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCategory" (
    "jobId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    CONSTRAINT "JobCategory_pkey" PRIMARY KEY ("jobId","categoryId")
);

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "type" "ServiceType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organization" TEXT,
    "companyId" INTEGER,
    "cityId" INTEGER,
    "country" TEXT DEFAULT 'Afghanistan',
    "category" TEXT,
    "tags" TEXT,
    "eligibility" TEXT,
    "documents" JSONB,
    "applyUrl" TEXT,
    "contactEmail" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingDate" TIMESTAMP(3),
    "status" "ServiceStatus" NOT NULL DEFAULT 'published',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'common',
    "companyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "photo" TEXT,
    "about" TEXT,
    "skills" TEXT,
    "phone" TEXT,
    "address" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "createdById" INTEGER,
    "targetAll" BOOLEAN NOT NULL DEFAULT false,
    "targetRole" "UserRole",
    "sendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "userId" INTEGER,
    "companyId" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cvUrl" TEXT,
    "coverLetter" TEXT,
    "answers" JSONB,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceApplication" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cvUrl" TEXT,
    "coverLetter" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "json" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "JobReview" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE INDEX "Company_name_idx" ON "Company"("name");
CREATE INDEX "Company_cityId_idx" ON "Company"("cityId");
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");
CREATE INDEX "Job_title_location_type_idx" ON "Job"("title", "location", "type");
CREATE INDEX "Job_status_closingDate_idx" ON "Job"("status", "closingDate");
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");
CREATE INDEX "Job_cityId_idx" ON "Job"("cityId");
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Advertisement_placement_isActive_startAt_endAt_idx" ON "Advertisement"("placement", "isActive", "startAt", "endAt");
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
CREATE INDEX "Service_type_status_closingDate_idx" ON "Service"("type", "status", "closingDate");
CREATE INDEX "Service_companyId_idx" ON "Service"("companyId");
CREATE INDEX "Service_cityId_idx" ON "Service"("cityId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "Notification_createdById_idx" ON "Notification"("createdById");
CREATE INDEX "NotificationRecipient_notificationId_idx" ON "NotificationRecipient"("notificationId");
CREATE INDEX "NotificationRecipient_userId_idx" ON "NotificationRecipient"("userId");
CREATE INDEX "NotificationRecipient_companyId_idx" ON "NotificationRecipient"("companyId");
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId", "userId");
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_companyId_key" ON "NotificationRecipient"("notificationId", "companyId");
CREATE INDEX "JobApplication_jobId_status_idx" ON "JobApplication"("jobId", "status");
CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");
CREATE UNIQUE INDEX "JobApplication_jobId_userId_key" ON "JobApplication"("jobId", "userId");
CREATE INDEX "ServiceApplication_serviceId_status_idx" ON "ServiceApplication"("serviceId", "status");
CREATE INDEX "ServiceApplication_userId_idx" ON "ServiceApplication"("userId");
CREATE UNIQUE INDEX "ServiceApplication_serviceId_userId_key" ON "ServiceApplication"("serviceId", "userId");
CREATE INDEX "JobReview_jobId_idx" ON "JobReview"("jobId");
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

ALTER TABLE "Company" ADD CONSTRAINT "Company_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCategory" ADD CONSTRAINT "JobCategory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobCategory" ADD CONSTRAINT "JobCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceApplication" ADD CONSTRAINT "ServiceApplication_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceApplication" ADD CONSTRAINT "ServiceApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
