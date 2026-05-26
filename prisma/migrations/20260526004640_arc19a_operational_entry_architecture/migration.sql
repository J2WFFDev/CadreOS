-- Arc 19A: Unified Operational Entry Architecture
-- Extends the Entry system introduced in 20260525153000_entry_system

-- Add FOLLOW_UP, ACTIVITY, READINESS_ITEM to EntryType enum
ALTER TYPE "EntryType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE "EntryType" ADD VALUE IF NOT EXISTS 'ACTIVITY';
ALTER TYPE "EntryType" ADD VALUE IF NOT EXISTS 'READINESS_ITEM';

-- CreateEnum: EntryObjectLinkTargetType
CREATE TYPE "EntryObjectLinkTargetType" AS ENUM (
  'PERSON',
  'TEAM',
  'PROGRAM',
  'SEASON',
  'EVENT',
  'ATTENDANCE_RECORD',
  'FACILITY',
  'FACILITY_RESOURCE',
  'RESOURCE_BOOKING',
  'GEAR_ITEM',
  'GEAR_ASSIGNMENT',
  'GEAR_CHECKOUT',
  'GEAR_MAINTENANCE_LOG',
  'FOLLOW_UP_TASK',
  'OBSERVATION_NOTE'
);

-- CreateEnum: EntryAssignmentRole
CREATE TYPE "EntryAssignmentRole" AS ENUM ('OWNER', 'COLLABORATOR', 'REVIEWER');

-- AlterTable: add occurredAt and updatedByPersonId to Entry
ALTER TABLE "Entry"
  ADD COLUMN "occurredAt" TIMESTAMP(3),
  ADD COLUMN "updatedByPersonId" TEXT;

-- AddForeignKey for Entry.updatedByPersonId
ALTER TABLE "Entry"
  ADD CONSTRAINT "Entry_updatedByPersonId_fkey"
  FOREIGN KEY ("updatedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for Entry.updatedByPersonId
CREATE INDEX "Entry_organizationId_updatedByPersonId_idx" ON "Entry"("organizationId", "updatedByPersonId");

-- CreateTable: EntryObjectLink
CREATE TABLE "EntryObjectLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "targetType" "EntryObjectLinkTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "createdByPersonId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryObjectLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntryObjectLink_organizationId_entryId_targetType_targetId_key"
  ON "EntryObjectLink"("organizationId", "entryId", "targetType", "targetId");
CREATE INDEX "EntryObjectLink_organizationId_entryId_idx" ON "EntryObjectLink"("organizationId", "entryId");
CREATE INDEX "EntryObjectLink_organizationId_targetType_targetId_idx" ON "EntryObjectLink"("organizationId", "targetType", "targetId");

ALTER TABLE "EntryObjectLink"
  ADD CONSTRAINT "EntryObjectLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryObjectLink"
  ADD CONSTRAINT "EntryObjectLink_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryObjectLink"
  ADD CONSTRAINT "EntryObjectLink_createdByPersonId_fkey"
  FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: EntryAssignment
CREATE TABLE "EntryAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "role" "EntryAssignmentRole" NOT NULL DEFAULT 'OWNER',
  "assignedByPersonId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "EntryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntryAssignment_entryId_personId_role_key"
  ON "EntryAssignment"("entryId", "personId", "role");
CREATE INDEX "EntryAssignment_organizationId_entryId_idx" ON "EntryAssignment"("organizationId", "entryId");
CREATE INDEX "EntryAssignment_organizationId_personId_idx" ON "EntryAssignment"("organizationId", "personId");

ALTER TABLE "EntryAssignment"
  ADD CONSTRAINT "EntryAssignment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryAssignment"
  ADD CONSTRAINT "EntryAssignment_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryAssignment"
  ADD CONSTRAINT "EntryAssignment_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryAssignment"
  ADD CONSTRAINT "EntryAssignment_assignedByPersonId_fkey"
  FOREIGN KEY ("assignedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: EntryStatusHistory
CREATE TABLE "EntryStatusHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "fromStatus" "EntryStatus",
  "toStatus" "EntryStatus" NOT NULL,
  "changedByPersonId" TEXT,
  "note" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntryStatusHistory_organizationId_entryId_changedAt_idx"
  ON "EntryStatusHistory"("organizationId", "entryId", "changedAt");

ALTER TABLE "EntryStatusHistory"
  ADD CONSTRAINT "EntryStatusHistory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryStatusHistory"
  ADD CONSTRAINT "EntryStatusHistory_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryStatusHistory"
  ADD CONSTRAINT "EntryStatusHistory_changedByPersonId_fkey"
  FOREIGN KEY ("changedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: EntryComment (deferred placeholder — schema established for future activation)
CREATE TABLE "EntryComment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "authorPersonId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "EntryComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntryComment_organizationId_entryId_createdAt_idx"
  ON "EntryComment"("organizationId", "entryId", "createdAt");

ALTER TABLE "EntryComment"
  ADD CONSTRAINT "EntryComment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryComment"
  ADD CONSTRAINT "EntryComment_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryComment"
  ADD CONSTRAINT "EntryComment_authorPersonId_fkey"
  FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: EntryReminder (deferred placeholder — schema established for future activation)
CREATE TABLE "EntryReminder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "remindAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  CONSTRAINT "EntryReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntryReminder_organizationId_entryId_idx" ON "EntryReminder"("organizationId", "entryId");
CREATE INDEX "EntryReminder_organizationId_personId_idx" ON "EntryReminder"("organizationId", "personId");

ALTER TABLE "EntryReminder"
  ADD CONSTRAINT "EntryReminder_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryReminder"
  ADD CONSTRAINT "EntryReminder_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryReminder"
  ADD CONSTRAINT "EntryReminder_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
