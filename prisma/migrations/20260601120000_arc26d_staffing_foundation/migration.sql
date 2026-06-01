-- Arc 26D: Staffing, Volunteer, and Coaching foundation
CREATE TYPE "StaffingAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED');

CREATE TYPE "StaffingRoleCategory" AS ENUM ('COACHING', 'VOLUNTEER', 'STAFF', 'ADMIN');

CREATE TYPE "StaffingCoverageType" AS ENUM ('PRACTICE', 'MATCH', 'CLINIC', 'MEETING');

CREATE TABLE "StaffingRole" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "StaffingRoleCategory" NOT NULL DEFAULT 'STAFF',
  "requiredQualificationType" TEXT,
  "requiredQualificationName" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isSystemDefined" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffingRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffingAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "staffingRoleId" TEXT NOT NULL,
  "programId" TEXT,
  "teamId" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "status" "StaffingAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffingAssignmentCoverage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "staffingAssignmentId" TEXT NOT NULL,
  "coverageType" "StaffingCoverageType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffingAssignmentCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffingRole_organizationId_name_key" ON "StaffingRole"("organizationId", "name");
CREATE UNIQUE INDEX "StaffingRole_organizationId_key_key" ON "StaffingRole"("organizationId", "key");
CREATE INDEX "StaffingRole_organizationId_active_category_idx" ON "StaffingRole"("organizationId", "active", "category");

CREATE INDEX "StaffingAssignment_organizationId_personId_status_idx" ON "StaffingAssignment"("organizationId", "personId", "status");
CREATE INDEX "StaffingAssignment_organizationId_staffingRoleId_status_idx" ON "StaffingAssignment"("organizationId", "staffingRoleId", "status");
CREATE INDEX "StaffingAssignment_organizationId_programId_teamId_status_idx" ON "StaffingAssignment"("organizationId", "programId", "teamId", "status");

CREATE UNIQUE INDEX "StaffingAssignmentCoverage_staffingAssignmentId_coverageType_key" ON "StaffingAssignmentCoverage"("staffingAssignmentId", "coverageType");
CREATE INDEX "StaffingAssignmentCoverage_organizationId_coverageType_idx" ON "StaffingAssignmentCoverage"("organizationId", "coverageType");

ALTER TABLE "StaffingRole"
  ADD CONSTRAINT "StaffingRole_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignment"
  ADD CONSTRAINT "StaffingAssignment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignment"
  ADD CONSTRAINT "StaffingAssignment_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignment"
  ADD CONSTRAINT "StaffingAssignment_staffingRoleId_fkey"
  FOREIGN KEY ("staffingRoleId") REFERENCES "StaffingRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignment"
  ADD CONSTRAINT "StaffingAssignment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignment"
  ADD CONSTRAINT "StaffingAssignment_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignmentCoverage"
  ADD CONSTRAINT "StaffingAssignmentCoverage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffingAssignmentCoverage"
  ADD CONSTRAINT "StaffingAssignmentCoverage_staffingAssignmentId_fkey"
  FOREIGN KEY ("staffingAssignmentId") REFERENCES "StaffingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
