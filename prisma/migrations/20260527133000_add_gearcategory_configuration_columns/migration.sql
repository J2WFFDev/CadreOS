-- Align GearCategory schema with prisma/schema.prisma for category template/create flows.
-- Idempotent recovery migration for environments that only have early GearOps baseline tables.

DO $$
BEGIN
  CREATE TYPE "GearCategoryBehaviorType" AS ENUM (
    'DURABLE',
    'CONSUMABLE',
    'KIT',
    'ASSIGNED_GEAR',
    'SHARED_GEAR',
    'EVENT_GEAR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearIdentifierType" AS ENUM (
    'QR_CODE',
    'BARCODE',
    'SERIAL_NUMBER',
    'ASSET_TAG',
    'MANUAL_LOOKUP'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearCustodyMode" AS ENUM (
    'FREE_CHECKOUT',
    'STAFF_ASSIGNMENT_ONLY',
    'REQUIRES_APPROVAL',
    'GUARDIAN_APPROVAL_REQUIRED',
    'NO_CUSTODY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearMaintenanceFrequency" AS ENUM (
    'AS_NEEDED',
    'MONTHLY',
    'QUARTERLY',
    'SEMI_ANNUAL',
    'ANNUAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearInspectionIntervalType" AS ENUM (
    'EVERY_USE',
    'BEFORE_EVENT',
    'AFTER_EVENT',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'ANNUALLY',
    'EVERY_N_DAYS',
    'AFTER_N_USES',
    'AFTER_N_DEPLOYMENTS',
    'MANUAL_DATE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearReportGroup" AS ENUM (
    'FIREARMS',
    'COMMUNICATIONS',
    'ELECTRONICS',
    'MEDICAL',
    'ATHLETIC_EQUIPMENT',
    'APPAREL',
    'TOOLS',
    'CONSUMABLES',
    'VEHICLES_LARGE_EQUIPMENT',
    'GENERAL',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "GearCategory"
  ADD COLUMN IF NOT EXISTS "templateSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "behaviorType" "GearCategoryBehaviorType" NOT NULL DEFAULT 'DURABLE',
  ADD COLUMN IF NOT EXISTS "custodyMode" "GearCustodyMode" NOT NULL DEFAULT 'FREE_CHECKOUT',
  ADD COLUMN IF NOT EXISTS "requiresReturnInspection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresMaintenanceTracking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "maintenanceFrequency" "GearMaintenanceFrequency",
  ADD COLUMN IF NOT EXISTS "maintenanceIntervalDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "maintenanceIntervalUses" INTEGER,
  ADD COLUMN IF NOT EXISTS "maintenanceIntervalDeployments" INTEGER,
  ADD COLUMN IF NOT EXISTS "maintenanceDueSoonDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS "inspectionIntervalType" "GearInspectionIntervalType",
  ADD COLUMN IF NOT EXISTS "inspectionIntervalDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "inspectionIntervalUses" INTEGER,
  ADD COLUMN IF NOT EXISTS "inspectionIntervalDeployments" INTEGER,
  ADD COLUMN IF NOT EXISTS "requiresPreEventInspection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresPostEventInspection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "inspectionDueSoonDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS "primaryIdentifierType" "GearIdentifierType" NOT NULL DEFAULT 'SERIAL_NUMBER',
  ADD COLUMN IF NOT EXISTS "supportsConsumableTracking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consumableLowStockDefault" INTEGER,
  ADD COLUMN IF NOT EXISTS "supportsEventDeployment" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reportGroup" "GearReportGroup" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "reportLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "isKitContainer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "guardianApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "GearCategory_organizationId_behaviorType_idx"
  ON "GearCategory" ("organizationId", "behaviorType");

CREATE INDEX IF NOT EXISTS "GearCategory_organizationId_reportGroup_idx"
  ON "GearCategory" ("organizationId", "reportGroup");
