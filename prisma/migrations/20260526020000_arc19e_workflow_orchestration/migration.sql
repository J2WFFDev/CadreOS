-- Arc 19E: Operational Workflow Orchestration
-- Adds lightweight workflow primitives: WorkflowTemplate, WorkflowRun, WorkflowStepEntry

-- CreateEnum: WorkflowTemplateType
CREATE TYPE "WorkflowTemplateType" AS ENUM (
  'FOLLOW_UP_CHAIN',
  'CHECKLIST',
  'READINESS_SEQUENCE',
  'ONBOARDING',
  'RECURRING_PROCEDURE'
);

-- CreateEnum: WorkflowRunStatus
CREATE TYPE "WorkflowRunStatus" AS ENUM (
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

-- CreateTable: WorkflowTemplate
CREATE TABLE "WorkflowTemplate" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "templateType"      "WorkflowTemplateType" NOT NULL,
  "stepsJson"         TEXT NOT NULL,
  "createdByPersonId" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  "archivedAt"        TIMESTAMP(3),
  CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowTemplate_organizationId_idx"
  ON "WorkflowTemplate"("organizationId");
CREATE INDEX "WorkflowTemplate_organizationId_templateType_idx"
  ON "WorkflowTemplate"("organizationId", "templateType");
CREATE INDEX "WorkflowTemplate_organizationId_archivedAt_idx"
  ON "WorkflowTemplate"("organizationId", "archivedAt");

ALTER TABLE "WorkflowTemplate"
  ADD CONSTRAINT "WorkflowTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate"
  ADD CONSTRAINT "WorkflowTemplate_createdByPersonId_fkey"
    FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: WorkflowRun
CREATE TABLE "WorkflowRun" (
  "id"                 TEXT NOT NULL,
  "organizationId"     TEXT NOT NULL,
  "workflowTemplateId" TEXT NOT NULL,
  "anchorEntryId"      TEXT,
  "status"             "WorkflowRunStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStepIndex"   INTEGER NOT NULL DEFAULT 0,
  "startedByPersonId"  TEXT NOT NULL,
  "assignedToPersonId" TEXT,
  "startedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"        TIMESTAMP(3),
  "cancelledAt"        TIMESTAMP(3),
  "metadataJson"       TEXT,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowRun_organizationId_status_idx"
  ON "WorkflowRun"("organizationId", "status");
CREATE INDEX "WorkflowRun_organizationId_workflowTemplateId_idx"
  ON "WorkflowRun"("organizationId", "workflowTemplateId");
CREATE INDEX "WorkflowRun_organizationId_anchorEntryId_idx"
  ON "WorkflowRun"("organizationId", "anchorEntryId");
CREATE INDEX "WorkflowRun_organizationId_startedByPersonId_idx"
  ON "WorkflowRun"("organizationId", "startedByPersonId");

ALTER TABLE "WorkflowRun"
  ADD CONSTRAINT "WorkflowRun_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun"
  ADD CONSTRAINT "WorkflowRun_workflowTemplateId_fkey"
    FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun"
  ADD CONSTRAINT "WorkflowRun_anchorEntryId_fkey"
    FOREIGN KEY ("anchorEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun"
  ADD CONSTRAINT "WorkflowRun_startedByPersonId_fkey"
    FOREIGN KEY ("startedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: WorkflowStepEntry
CREATE TABLE "WorkflowStepEntry" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workflowRunId"  TEXT NOT NULL,
  "stepIndex"      INTEGER NOT NULL,
  "entryId"        TEXT NOT NULL,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowStepEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowStepEntry_entryId_key"
  ON "WorkflowStepEntry"("entryId");
CREATE INDEX "WorkflowStepEntry_organizationId_workflowRunId_idx"
  ON "WorkflowStepEntry"("organizationId", "workflowRunId");
CREATE INDEX "WorkflowStepEntry_organizationId_entryId_idx"
  ON "WorkflowStepEntry"("organizationId", "entryId");

ALTER TABLE "WorkflowStepEntry"
  ADD CONSTRAINT "WorkflowStepEntry_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepEntry"
  ADD CONSTRAINT "WorkflowStepEntry_workflowRunId_fkey"
    FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepEntry"
  ADD CONSTRAINT "WorkflowStepEntry_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
