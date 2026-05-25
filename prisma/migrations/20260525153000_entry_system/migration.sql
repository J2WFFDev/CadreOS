-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('TASK', 'NOTE', 'EVENT', 'DECISION', 'JOURNAL', 'HABIT', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "EntryVisibility" AS ENUM ('STAFF_ONLY', 'TEAM_STAFF', 'ORGANIZATION_SCOPED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntryPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Entry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "teamId" TEXT,
  "type" "EntryType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdByPersonId" TEXT NOT NULL,
  "assignedToPersonId" TEXT,
  "visibility" "EntryVisibility" NOT NULL DEFAULT 'STAFF_ONLY',
  "status" "EntryStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "EntryPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3),
  "dueTime" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "timezone" TEXT,
  "parentEntryId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "taskCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "taskChecklistJson" TEXT,
  "taskRemindersJson" TEXT,
  "taskRecurrenceRule" TEXT,
  "noteIsPinned" BOOLEAN NOT NULL DEFAULT false,
  "noteIsFavorite" BOOLEAN NOT NULL DEFAULT false,
  "noteChecklistJson" TEXT,
  "sourceTaskId" TEXT,
  "sourceNoteId" TEXT,
  CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fromEntryId" TEXT NOT NULL,
  "toEntryId" TEXT NOT NULL,
  "createdByPersonId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryActivity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "actorPersonId" TEXT,
  "action" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entry_sourceTaskId_key" ON "Entry"("sourceTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_sourceNoteId_key" ON "Entry"("sourceNoteId");

-- CreateIndex
CREATE INDEX "Entry_organizationId_type_createdAt_idx" ON "Entry"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Entry_organizationId_status_dueDate_idx" ON "Entry"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Entry_organizationId_deletedAt_idx" ON "Entry"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Entry_organizationId_createdByPersonId_idx" ON "Entry"("organizationId", "createdByPersonId");

-- CreateIndex
CREATE INDEX "Entry_organizationId_assignedToPersonId_idx" ON "Entry"("organizationId", "assignedToPersonId");

-- CreateIndex
CREATE INDEX "Entry_organizationId_parentEntryId_idx" ON "Entry"("organizationId", "parentEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryLink_organizationId_fromEntryId_toEntryId_key" ON "EntryLink"("organizationId", "fromEntryId", "toEntryId");

-- CreateIndex
CREATE INDEX "EntryLink_organizationId_fromEntryId_idx" ON "EntryLink"("organizationId", "fromEntryId");

-- CreateIndex
CREATE INDEX "EntryLink_organizationId_toEntryId_idx" ON "EntryLink"("organizationId", "toEntryId");

-- CreateIndex
CREATE INDEX "EntryActivity_organizationId_entryId_createdAt_idx" ON "EntryActivity"("organizationId", "entryId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryActivity_organizationId_actorPersonId_createdAt_idx" ON "EntryActivity"("organizationId", "actorPersonId", "createdAt");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_createdByPersonId_fkey" FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_assignedToPersonId_fkey" FOREIGN KEY ("assignedToPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_parentEntryId_fkey" FOREIGN KEY ("parentEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "FollowUpTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "ObservationNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryLink" ADD CONSTRAINT "EntryLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryLink" ADD CONSTRAINT "EntryLink_fromEntryId_fkey" FOREIGN KEY ("fromEntryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryLink" ADD CONSTRAINT "EntryLink_toEntryId_fkey" FOREIGN KEY ("toEntryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryLink" ADD CONSTRAINT "EntryLink_createdByPersonId_fkey" FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryActivity" ADD CONSTRAINT "EntryActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryActivity" ADD CONSTRAINT "EntryActivity_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryActivity" ADD CONSTRAINT "EntryActivity_actorPersonId_fkey" FOREIGN KEY ("actorPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
