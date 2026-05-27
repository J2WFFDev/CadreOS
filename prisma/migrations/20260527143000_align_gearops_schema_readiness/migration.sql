-- Align GearOps schema readiness with the current Prisma schema.
-- This recovery migration is idempotent so setup workflows can safely apply it
-- against environments that only have the early GearOps baseline tables.

DO $$ BEGIN
  CREATE TYPE "InventoryAuditType" AS ENUM (
    'SCHEDULED',
    'AD_HOC',
    'VAULT_CAGE',
    'EVENT_VERIFICATION',
    'CHECKOUT_RECONCILIATION',
    'CONSUMABLE_VERIFICATION',
    'READINESS_INSPECTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAuditScope" AS ENUM (
    'ORGANIZATION',
    'LOCATION',
    'KIT',
    'EVENT',
    'PERSON',
    'CONSUMABLE',
    'READINESS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAuditSessionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryVerificationStatus" AS ENUM (
    'PENDING',
    'VERIFIED_MATCH',
    'VERIFIED_DISCREPANCY',
    'NOT_FOUND',
    'SKIPPED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryDiscrepancyType" AS ENUM (
    'MISSING_INVENTORY',
    'WRONG_LOCATION',
    'DAMAGED_CONDITION',
    'ASSIGNMENT_MISMATCH',
    'QUANTITY_MISMATCH',
    'READINESS_FAILURE',
    'UNAUTHORIZED_CUSTODY_STATE',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryDiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAuditCheckpointStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearKitType" AS ENUM ('KIT', 'BUNDLE', 'CASE', 'BAG', 'SET', 'LOADOUT', 'EQUIPMENT_PACKAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearKitComponentRole" AS ENUM ('REQUIRED', 'OPTIONAL', 'QUANTITY_MANAGED', 'CONSUMABLE', 'REPLACEABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearKitReadinessLabel" AS ENUM (
    'READY',
    'READY_WITH_WARNING',
    'INCOMPLETE',
    'LIMITED_USE',
    'NEEDS_INSPECTION',
    'MAINTENANCE_NEEDED',
    'OUT_OF_SERVICE',
    'MISSING_COMPONENTS',
    'CONFLICT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearKitCustodyStatus" AS ENUM (
    'AVAILABLE',
    'CHECKED_OUT',
    'ASSIGNED',
    'DEPLOYED',
    'RESERVED',
    'IN_INSPECTION',
    'IN_MAINTENANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearKitInspectionStatus" AS ENUM ('PASSED', 'PASSED_WITH_NOTES', 'FAILED', 'INCOMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearKitCustodyEventType" AS ENUM (
    'CHECKED_OUT',
    'CHECKED_IN',
    'ASSIGNED',
    'UNASSIGNED',
    'DEPLOYED',
    'RECOVERED',
    'RESERVED',
    'RESERVATION_RELEASED',
    'TRANSFERRED',
    'INSPECTION_LOGGED',
    'PARTIAL_CHECKOUT',
    'PARTIAL_RETURN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearInspectionDueStatus" AS ENUM ('NOT_SCHEDULED', 'CURRENT', 'DUE_SOON', 'DUE', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearMaintenanceDueStatus" AS ENUM ('NOT_SCHEDULED', 'CURRENT', 'DUE_SOON', 'DUE', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearItemInspectionResult" AS ENUM (
    'PASSED',
    'PASSED_WITH_NOTES',
    'FAILED',
    'MAINTENANCE_NEEDED',
    'OUT_OF_SERVICE',
    'LIMITED_USE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GearInspectionContext" AS ENUM (
    'ROUTINE',
    'PRE_EVENT',
    'POST_EVENT',
    'PERIODIC',
    'RETURN_INSPECTION',
    'CONDITION_CHECK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "GearItem"
  ADD COLUMN IF NOT EXISTS "lastInspectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastInspectionResult" "GearItemInspectionResult",
  ADD COLUMN IF NOT EXISTS "nextInspectionDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inspectionDueStatus" "GearInspectionDueStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
  ADD COLUMN IF NOT EXISTS "nextMaintenanceDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "maintenanceDueStatus" "GearMaintenanceDueStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
  ADD COLUMN IF NOT EXISTS "totalUseCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalDeploymentCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GearMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "nextMaintenanceDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isPostEventRecovery" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "GearInspectionRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "gearItemId" TEXT NOT NULL,
  "inspectedByPersonId" TEXT NOT NULL,
  "result" "GearItemInspectionResult" NOT NULL,
  "context" "GearInspectionContext" NOT NULL DEFAULT 'ROUTINE',
  "notes" TEXT,
  "checklistJson" TEXT,
  "failedItemsJson" TEXT,
  "relatedEventId" TEXT,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextInspectionDueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearInspectionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearCategoryField" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "fieldLabel" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL,
  "fieldOptions" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearCategoryField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventGearRequirementTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "gearCategoryId" TEXT,
  "label" TEXT NOT NULL,
  "requirementType" "EventGearRequirementType" NOT NULL DEFAULT 'REQUIRED',
  "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventGearRequirementTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearOpsOrganizationSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "defaultCustodyMode" "GearCustodyMode" NOT NULL DEFAULT 'FREE_CHECKOUT',
  "enableGuardianApproval" BOOLEAN NOT NULL DEFAULT false,
  "enableConsumableTracking" BOOLEAN NOT NULL DEFAULT true,
  "enableEventDeployment" BOOLEAN NOT NULL DEFAULT true,
  "enableReadinessTracking" BOOLEAN NOT NULL DEFAULT true,
  "enableMaintenanceTracking" BOOLEAN NOT NULL DEFAULT true,
  "defaultReportGroup" "GearReportGroup" NOT NULL DEFAULT 'GENERAL',
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearOpsOrganizationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryKit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kitType" "GearKitType" NOT NULL DEFAULT 'KIT',
  "ownerPersonId" TEXT,
  "assignedToPersonId" TEXT,
  "assignedToTeamId" TEXT,
  "assignedToEventId" TEXT,
  "labelCode" TEXT,
  "readinessLabel" "GearKitReadinessLabel" NOT NULL DEFAULT 'INCOMPLETE',
  "custodyStatus" "GearKitCustodyStatus" NOT NULL DEFAULT 'AVAILABLE',
  "lastInspectedAt" TIMESTAMP(3),
  "lastInspectionStatus" "GearKitInspectionStatus",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryKit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryKitItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kitId" TEXT NOT NULL,
  "gearItemId" TEXT NOT NULL,
  "componentRole" "GearKitComponentRole" NOT NULL DEFAULT 'REQUIRED',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "quantityExpected" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "InventoryKitItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearKitInspection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kitId" TEXT NOT NULL,
  "inspectedByPersonId" TEXT NOT NULL,
  "status" "GearKitInspectionStatus" NOT NULL,
  "notes" TEXT,
  "itemConditionsJson" TEXT,
  "missingItemIdsJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearKitInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearKitCustodyEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kitId" TEXT NOT NULL,
  "eventType" "GearKitCustodyEventType" NOT NULL,
  "actorPersonId" TEXT NOT NULL,
  "custodyPersonId" TEXT,
  "relatedEventId" TEXT,
  "notes" TEXT,
  "childItemIdsJson" TEXT,
  "isPartial" BOOLEAN NOT NULL DEFAULT false,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GearKitCustodyEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "auditType" "InventoryAuditType" NOT NULL,
  "scope" "InventoryAuditScope" NOT NULL,
  "scopeReferenceId" TEXT,
  "cadenceDays" INTEGER,
  "nextScheduledAt" TIMESTAMP(3),
  "lastExecutedAt" TIMESTAMP(3),
  "createdByPersonId" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryAuditSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "inventoryAuditId" TEXT,
  "title" TEXT NOT NULL,
  "status" "InventoryAuditSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "scopeSnapshotJson" TEXT,
  "plannedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "startedByPersonId" TEXT,
  "completedByPersonId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAuditSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryAuditCheckpoint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "auditSessionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "status" "InventoryAuditCheckpointStatus" NOT NULL DEFAULT 'PENDING',
  "expectedItemCount" INTEGER,
  "verifiedItemCount" INTEGER NOT NULL DEFAULT 0,
  "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAuditCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryAuditResult" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "auditSessionId" TEXT NOT NULL,
  "gearItemId" TEXT,
  "scanEventId" TEXT,
  "verificationStatus" "InventoryVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "expectedLocationId" TEXT,
  "observedLocationId" TEXT,
  "expectedCustodyPersonId" TEXT,
  "observedCustodyPersonId" TEXT,
  "expectedQuantity" INTEGER,
  "observedQuantity" INTEGER,
  "expectedReadinessState" "InventoryReadinessState",
  "observedReadinessState" "InventoryReadinessState",
  "observedConditionStatus" "GearConditionStatus",
  "scannedCode" TEXT,
  "notes" TEXT,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedByPersonId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAuditResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryAuditDiscrepancy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "auditSessionId" TEXT NOT NULL,
  "auditResultId" TEXT,
  "gearItemId" TEXT,
  "locationId" TEXT,
  "discrepancyType" "InventoryDiscrepancyType" NOT NULL,
  "status" "InventoryDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "details" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByPersonId" TEXT,
  "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAuditDiscrepancy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GearItem_organizationId_inspectionDueStatus_idx"
  ON "GearItem"("organizationId", "inspectionDueStatus");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_maintenanceDueStatus_idx"
  ON "GearItem"("organizationId", "maintenanceDueStatus");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_nextInspectionDueAt_idx"
  ON "GearItem"("organizationId", "nextInspectionDueAt");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_nextMaintenanceDueAt_idx"
  ON "GearItem"("organizationId", "nextMaintenanceDueAt");

CREATE INDEX IF NOT EXISTS "GearInspectionRecord_organizationId_gearItemId_performedAt_idx"
  ON "GearInspectionRecord"("organizationId", "gearItemId", "performedAt");
CREATE INDEX IF NOT EXISTS "GearInspectionRecord_organizationId_result_performedAt_idx"
  ON "GearInspectionRecord"("organizationId", "result", "performedAt");
CREATE INDEX IF NOT EXISTS "GearInspectionRecord_organizationId_inspectedByPersonId_performedAt_idx"
  ON "GearInspectionRecord"("organizationId", "inspectedByPersonId", "performedAt");
CREATE INDEX IF NOT EXISTS "GearInspectionRecord_organizationId_context_performedAt_idx"
  ON "GearInspectionRecord"("organizationId", "context", "performedAt");
CREATE INDEX IF NOT EXISTS "GearInspectionRecord_organizationId_relatedEventId_performedAt_idx"
  ON "GearInspectionRecord"("organizationId", "relatedEventId", "performedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GearCategoryField_categoryId_fieldKey_key"
  ON "GearCategoryField"("categoryId", "fieldKey");
CREATE INDEX IF NOT EXISTS "GearCategoryField_organizationId_categoryId_idx"
  ON "GearCategoryField"("organizationId", "categoryId");

CREATE UNIQUE INDEX IF NOT EXISTS "EventGearRequirementTemplate_organizationId_name_key"
  ON "EventGearRequirementTemplate"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "EventGearRequirementTemplate_organizationId_idx"
  ON "EventGearRequirementTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "EventGearRequirementTemplate_organizationId_gearCategoryId_idx"
  ON "EventGearRequirementTemplate"("organizationId", "gearCategoryId");
CREATE INDEX IF NOT EXISTS "EventGearRequirementTemplate_organizationId_isActive_idx"
  ON "EventGearRequirementTemplate"("organizationId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "GearOpsOrganizationSettings_organizationId_key"
  ON "GearOpsOrganizationSettings"("organizationId");
CREATE INDEX IF NOT EXISTS "GearOpsOrganizationSettings_organizationId_idx"
  ON "GearOpsOrganizationSettings"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryKit_organizationId_name_key"
  ON "InventoryKit"("organizationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryKit_organizationId_labelCode_key"
  ON "InventoryKit"("organizationId", "labelCode");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_idx"
  ON "InventoryKit"("organizationId");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_isActive_idx"
  ON "InventoryKit"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_kitType_idx"
  ON "InventoryKit"("organizationId", "kitType");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_custodyStatus_idx"
  ON "InventoryKit"("organizationId", "custodyStatus");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_readinessLabel_idx"
  ON "InventoryKit"("organizationId", "readinessLabel");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_ownerPersonId_idx"
  ON "InventoryKit"("organizationId", "ownerPersonId");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_assignedToPersonId_idx"
  ON "InventoryKit"("organizationId", "assignedToPersonId");
CREATE INDEX IF NOT EXISTS "InventoryKit_organizationId_assignedToEventId_idx"
  ON "InventoryKit"("organizationId", "assignedToEventId");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryKitItem_kitId_gearItemId_key"
  ON "InventoryKitItem"("kitId", "gearItemId");
CREATE INDEX IF NOT EXISTS "InventoryKitItem_organizationId_kitId_idx"
  ON "InventoryKitItem"("organizationId", "kitId");
CREATE INDEX IF NOT EXISTS "InventoryKitItem_organizationId_kitId_componentRole_idx"
  ON "InventoryKitItem"("organizationId", "kitId", "componentRole");
CREATE INDEX IF NOT EXISTS "InventoryKitItem_organizationId_gearItemId_idx"
  ON "InventoryKitItem"("organizationId", "gearItemId");

CREATE INDEX IF NOT EXISTS "GearKitInspection_organizationId_kitId_createdAt_idx"
  ON "GearKitInspection"("organizationId", "kitId", "createdAt");
CREATE INDEX IF NOT EXISTS "GearKitInspection_organizationId_status_createdAt_idx"
  ON "GearKitInspection"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "GearKitInspection_organizationId_inspectedByPersonId_createdAt_idx"
  ON "GearKitInspection"("organizationId", "inspectedByPersonId", "createdAt");

CREATE INDEX IF NOT EXISTS "GearKitCustodyEvent_organizationId_kitId_occurredAt_idx"
  ON "GearKitCustodyEvent"("organizationId", "kitId", "occurredAt");
CREATE INDEX IF NOT EXISTS "GearKitCustodyEvent_organizationId_eventType_occurredAt_idx"
  ON "GearKitCustodyEvent"("organizationId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "GearKitCustodyEvent_organizationId_actorPersonId_occurredAt_idx"
  ON "GearKitCustodyEvent"("organizationId", "actorPersonId", "occurredAt");
CREATE INDEX IF NOT EXISTS "GearKitCustodyEvent_organizationId_custodyPersonId_occurredAt_idx"
  ON "GearKitCustodyEvent"("organizationId", "custodyPersonId", "occurredAt");
CREATE INDEX IF NOT EXISTS "GearKitCustodyEvent_organizationId_relatedEventId_occurredAt_idx"
  ON "GearKitCustodyEvent"("organizationId", "relatedEventId", "occurredAt");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAudit_organizationId_name_key"
  ON "InventoryAudit"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "InventoryAudit_organizationId_auditType_idx"
  ON "InventoryAudit"("organizationId", "auditType");
CREATE INDEX IF NOT EXISTS "InventoryAudit_organizationId_scope_idx"
  ON "InventoryAudit"("organizationId", "scope");
CREATE INDEX IF NOT EXISTS "InventoryAudit_organizationId_archivedAt_idx"
  ON "InventoryAudit"("organizationId", "archivedAt");
CREATE INDEX IF NOT EXISTS "InventoryAudit_organizationId_nextScheduledAt_idx"
  ON "InventoryAudit"("organizationId", "nextScheduledAt");

CREATE INDEX IF NOT EXISTS "InventoryAuditSession_organizationId_status_startedAt_idx"
  ON "InventoryAuditSession"("organizationId", "status", "startedAt");
CREATE INDEX IF NOT EXISTS "InventoryAuditSession_organizationId_inventoryAuditId_status_idx"
  ON "InventoryAuditSession"("organizationId", "inventoryAuditId", "status");
CREATE INDEX IF NOT EXISTS "InventoryAuditSession_organizationId_plannedAt_idx"
  ON "InventoryAuditSession"("organizationId", "plannedAt");

CREATE INDEX IF NOT EXISTS "InventoryAuditCheckpoint_organizationId_auditSessionId_orderIndex_idx"
  ON "InventoryAuditCheckpoint"("organizationId", "auditSessionId", "orderIndex");
CREATE INDEX IF NOT EXISTS "InventoryAuditCheckpoint_organizationId_status_idx"
  ON "InventoryAuditCheckpoint"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "InventoryAuditResult_organizationId_auditSessionId_verificationStatus_idx"
  ON "InventoryAuditResult"("organizationId", "auditSessionId", "verificationStatus");
CREATE INDEX IF NOT EXISTS "InventoryAuditResult_organizationId_gearItemId_verifiedAt_idx"
  ON "InventoryAuditResult"("organizationId", "gearItemId", "verifiedAt");
CREATE INDEX IF NOT EXISTS "InventoryAuditResult_organizationId_verifiedAt_idx"
  ON "InventoryAuditResult"("organizationId", "verifiedAt");
CREATE INDEX IF NOT EXISTS "InventoryAuditResult_organizationId_expectedLocationId_idx"
  ON "InventoryAuditResult"("organizationId", "expectedLocationId");
CREATE INDEX IF NOT EXISTS "InventoryAuditResult_organizationId_observedLocationId_idx"
  ON "InventoryAuditResult"("organizationId", "observedLocationId");

CREATE INDEX IF NOT EXISTS "InventoryAuditDiscrepancy_organizationId_auditSessionId_status_idx"
  ON "InventoryAuditDiscrepancy"("organizationId", "auditSessionId", "status");
CREATE INDEX IF NOT EXISTS "InventoryAuditDiscrepancy_organizationId_discrepancyType_status_idx"
  ON "InventoryAuditDiscrepancy"("organizationId", "discrepancyType", "status");
CREATE INDEX IF NOT EXISTS "InventoryAuditDiscrepancy_organizationId_gearItemId_status_idx"
  ON "InventoryAuditDiscrepancy"("organizationId", "gearItemId", "status");
CREATE INDEX IF NOT EXISTS "InventoryAuditDiscrepancy_organizationId_locationId_status_idx"
  ON "InventoryAuditDiscrepancy"("organizationId", "locationId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearInspectionRecord_organizationId_fkey') THEN
    ALTER TABLE "GearInspectionRecord"
      ADD CONSTRAINT "GearInspectionRecord_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearInspectionRecord_gearItemId_fkey') THEN
    ALTER TABLE "GearInspectionRecord"
      ADD CONSTRAINT "GearInspectionRecord_gearItemId_fkey"
      FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearInspectionRecord_inspectedByPersonId_fkey') THEN
    ALTER TABLE "GearInspectionRecord"
      ADD CONSTRAINT "GearInspectionRecord_inspectedByPersonId_fkey"
      FOREIGN KEY ("inspectedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearInspectionRecord_relatedEventId_fkey') THEN
    ALTER TABLE "GearInspectionRecord"
      ADD CONSTRAINT "GearInspectionRecord_relatedEventId_fkey"
      FOREIGN KEY ("relatedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearCategoryField_organizationId_fkey') THEN
    ALTER TABLE "GearCategoryField"
      ADD CONSTRAINT "GearCategoryField_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearCategoryField_categoryId_fkey') THEN
    ALTER TABLE "GearCategoryField"
      ADD CONSTRAINT "GearCategoryField_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "GearCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventGearRequirementTemplate_organizationId_fkey') THEN
    ALTER TABLE "EventGearRequirementTemplate"
      ADD CONSTRAINT "EventGearRequirementTemplate_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventGearRequirementTemplate_gearCategoryId_fkey') THEN
    ALTER TABLE "EventGearRequirementTemplate"
      ADD CONSTRAINT "EventGearRequirementTemplate_gearCategoryId_fkey"
      FOREIGN KEY ("gearCategoryId") REFERENCES "GearCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearOpsOrganizationSettings_organizationId_fkey') THEN
    ALTER TABLE "GearOpsOrganizationSettings"
      ADD CONSTRAINT "GearOpsOrganizationSettings_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKit_organizationId_fkey') THEN
    ALTER TABLE "InventoryKit"
      ADD CONSTRAINT "InventoryKit_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKit_ownerPersonId_fkey') THEN
    ALTER TABLE "InventoryKit"
      ADD CONSTRAINT "InventoryKit_ownerPersonId_fkey"
      FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKit_assignedToPersonId_fkey') THEN
    ALTER TABLE "InventoryKit"
      ADD CONSTRAINT "InventoryKit_assignedToPersonId_fkey"
      FOREIGN KEY ("assignedToPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKit_assignedToTeamId_fkey') THEN
    ALTER TABLE "InventoryKit"
      ADD CONSTRAINT "InventoryKit_assignedToTeamId_fkey"
      FOREIGN KEY ("assignedToTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKit_assignedToEventId_fkey') THEN
    ALTER TABLE "InventoryKit"
      ADD CONSTRAINT "InventoryKit_assignedToEventId_fkey"
      FOREIGN KEY ("assignedToEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKitItem_organizationId_fkey') THEN
    ALTER TABLE "InventoryKitItem"
      ADD CONSTRAINT "InventoryKitItem_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKitItem_kitId_fkey') THEN
    ALTER TABLE "InventoryKitItem"
      ADD CONSTRAINT "InventoryKitItem_kitId_fkey"
      FOREIGN KEY ("kitId") REFERENCES "InventoryKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryKitItem_gearItemId_fkey') THEN
    ALTER TABLE "InventoryKitItem"
      ADD CONSTRAINT "InventoryKitItem_gearItemId_fkey"
      FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitInspection_organizationId_fkey') THEN
    ALTER TABLE "GearKitInspection"
      ADD CONSTRAINT "GearKitInspection_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitInspection_kitId_fkey') THEN
    ALTER TABLE "GearKitInspection"
      ADD CONSTRAINT "GearKitInspection_kitId_fkey"
      FOREIGN KEY ("kitId") REFERENCES "InventoryKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitInspection_inspectedByPersonId_fkey') THEN
    ALTER TABLE "GearKitInspection"
      ADD CONSTRAINT "GearKitInspection_inspectedByPersonId_fkey"
      FOREIGN KEY ("inspectedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitCustodyEvent_organizationId_fkey') THEN
    ALTER TABLE "GearKitCustodyEvent"
      ADD CONSTRAINT "GearKitCustodyEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitCustodyEvent_kitId_fkey') THEN
    ALTER TABLE "GearKitCustodyEvent"
      ADD CONSTRAINT "GearKitCustodyEvent_kitId_fkey"
      FOREIGN KEY ("kitId") REFERENCES "InventoryKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitCustodyEvent_actorPersonId_fkey') THEN
    ALTER TABLE "GearKitCustodyEvent"
      ADD CONSTRAINT "GearKitCustodyEvent_actorPersonId_fkey"
      FOREIGN KEY ("actorPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitCustodyEvent_custodyPersonId_fkey') THEN
    ALTER TABLE "GearKitCustodyEvent"
      ADD CONSTRAINT "GearKitCustodyEvent_custodyPersonId_fkey"
      FOREIGN KEY ("custodyPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearKitCustodyEvent_relatedEventId_fkey') THEN
    ALTER TABLE "GearKitCustodyEvent"
      ADD CONSTRAINT "GearKitCustodyEvent_relatedEventId_fkey"
      FOREIGN KEY ("relatedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAudit_organizationId_fkey') THEN
    ALTER TABLE "InventoryAudit"
      ADD CONSTRAINT "InventoryAudit_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAudit_createdByPersonId_fkey') THEN
    ALTER TABLE "InventoryAudit"
      ADD CONSTRAINT "InventoryAudit_createdByPersonId_fkey"
      FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditSession_organizationId_fkey') THEN
    ALTER TABLE "InventoryAuditSession"
      ADD CONSTRAINT "InventoryAuditSession_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditSession_inventoryAuditId_fkey') THEN
    ALTER TABLE "InventoryAuditSession"
      ADD CONSTRAINT "InventoryAuditSession_inventoryAuditId_fkey"
      FOREIGN KEY ("inventoryAuditId") REFERENCES "InventoryAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditSession_startedByPersonId_fkey') THEN
    ALTER TABLE "InventoryAuditSession"
      ADD CONSTRAINT "InventoryAuditSession_startedByPersonId_fkey"
      FOREIGN KEY ("startedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditSession_completedByPersonId_fkey') THEN
    ALTER TABLE "InventoryAuditSession"
      ADD CONSTRAINT "InventoryAuditSession_completedByPersonId_fkey"
      FOREIGN KEY ("completedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditCheckpoint_organizationId_fkey') THEN
    ALTER TABLE "InventoryAuditCheckpoint"
      ADD CONSTRAINT "InventoryAuditCheckpoint_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditCheckpoint_auditSessionId_fkey') THEN
    ALTER TABLE "InventoryAuditCheckpoint"
      ADD CONSTRAINT "InventoryAuditCheckpoint_auditSessionId_fkey"
      FOREIGN KEY ("auditSessionId") REFERENCES "InventoryAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_organizationId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_auditSessionId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_auditSessionId_fkey"
      FOREIGN KEY ("auditSessionId") REFERENCES "InventoryAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_gearItemId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_gearItemId_fkey"
      FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_expectedLocationId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_expectedLocationId_fkey"
      FOREIGN KEY ("expectedLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_observedLocationId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_observedLocationId_fkey"
      FOREIGN KEY ("observedLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_expectedCustodyPersonId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_expectedCustodyPersonId_fkey"
      FOREIGN KEY ("expectedCustodyPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_observedCustodyPersonId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_observedCustodyPersonId_fkey"
      FOREIGN KEY ("observedCustodyPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditResult_verifiedByPersonId_fkey') THEN
    ALTER TABLE "InventoryAuditResult"
      ADD CONSTRAINT "InventoryAuditResult_verifiedByPersonId_fkey"
      FOREIGN KEY ("verifiedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditDiscrepancy_organizationId_fkey') THEN
    ALTER TABLE "InventoryAuditDiscrepancy"
      ADD CONSTRAINT "InventoryAuditDiscrepancy_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditDiscrepancy_auditSessionId_fkey') THEN
    ALTER TABLE "InventoryAuditDiscrepancy"
      ADD CONSTRAINT "InventoryAuditDiscrepancy_auditSessionId_fkey"
      FOREIGN KEY ("auditSessionId") REFERENCES "InventoryAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditDiscrepancy_auditResultId_fkey') THEN
    ALTER TABLE "InventoryAuditDiscrepancy"
      ADD CONSTRAINT "InventoryAuditDiscrepancy_auditResultId_fkey"
      FOREIGN KEY ("auditResultId") REFERENCES "InventoryAuditResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditDiscrepancy_gearItemId_fkey') THEN
    ALTER TABLE "InventoryAuditDiscrepancy"
      ADD CONSTRAINT "InventoryAuditDiscrepancy_gearItemId_fkey"
      FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditDiscrepancy_locationId_fkey') THEN
    ALTER TABLE "InventoryAuditDiscrepancy"
      ADD CONSTRAINT "InventoryAuditDiscrepancy_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAuditDiscrepancy_resolvedByPersonId_fkey') THEN
    ALTER TABLE "InventoryAuditDiscrepancy"
      ADD CONSTRAINT "InventoryAuditDiscrepancy_resolvedByPersonId_fkey"
      FOREIGN KEY ("resolvedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
