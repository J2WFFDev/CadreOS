-- Recovery migration: ensure GearOps consumable/maintenance tables exist in production.
-- This is idempotent and non-destructive.

DO $$
BEGIN
  CREATE TYPE "GearMaintenanceType" AS ENUM ('INSPECTION', 'REPAIR', 'CLEANING', 'REPLACEMENT', 'RETIREMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ConsumableTransactionType" AS ENUM ('RECEIVED', 'USED', 'DISTRIBUTED', 'DISPOSED', 'ADJUSTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GearMaintenanceLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "gearItemId" TEXT NOT NULL,
  "performedByPersonId" TEXT NOT NULL,
  "maintenanceType" "GearMaintenanceType" NOT NULL,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conditionBefore" "GearConditionStatus",
  "conditionAfter" "GearConditionStatus",
  "notes" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearMaintenanceLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConsumableTransaction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "gearItemId" TEXT NOT NULL,
  "transactionType" "ConsumableTransactionType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "recordedByPersonId" TEXT NOT NULL,
  "eventId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsumableTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GearMaintenanceLog_organizationId_gearItemId_performedAt_idx"
ON "GearMaintenanceLog"("organizationId", "gearItemId", "performedAt");
CREATE INDEX IF NOT EXISTS "GearMaintenanceLog_organizationId_performedByPersonId_performedAt_idx"
ON "GearMaintenanceLog"("organizationId", "performedByPersonId", "performedAt");
CREATE INDEX IF NOT EXISTS "GearMaintenanceLog_organizationId_maintenanceType_performedAt_idx"
ON "GearMaintenanceLog"("organizationId", "maintenanceType", "performedAt");

CREATE INDEX IF NOT EXISTS "ConsumableTransaction_organizationId_gearItemId_recordedAt_idx"
ON "ConsumableTransaction"("organizationId", "gearItemId", "recordedAt");
CREATE INDEX IF NOT EXISTS "ConsumableTransaction_organizationId_transactionType_recordedAt_idx"
ON "ConsumableTransaction"("organizationId", "transactionType", "recordedAt");
CREATE INDEX IF NOT EXISTS "ConsumableTransaction_organizationId_recordedByPersonId_recordedAt_idx"
ON "ConsumableTransaction"("organizationId", "recordedByPersonId", "recordedAt");
CREATE INDEX IF NOT EXISTS "ConsumableTransaction_organizationId_eventId_recordedAt_idx"
ON "ConsumableTransaction"("organizationId", "eventId", "recordedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearMaintenanceLog_organizationId_fkey'
  ) THEN
    ALTER TABLE "GearMaintenanceLog"
    ADD CONSTRAINT "GearMaintenanceLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearMaintenanceLog_gearItemId_fkey'
  ) THEN
    ALTER TABLE "GearMaintenanceLog"
    ADD CONSTRAINT "GearMaintenanceLog_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearMaintenanceLog_performedByPersonId_fkey'
  ) THEN
    ALTER TABLE "GearMaintenanceLog"
    ADD CONSTRAINT "GearMaintenanceLog_performedByPersonId_fkey"
    FOREIGN KEY ("performedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsumableTransaction_organizationId_fkey'
  ) THEN
    ALTER TABLE "ConsumableTransaction"
    ADD CONSTRAINT "ConsumableTransaction_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsumableTransaction_gearItemId_fkey'
  ) THEN
    ALTER TABLE "ConsumableTransaction"
    ADD CONSTRAINT "ConsumableTransaction_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsumableTransaction_recordedByPersonId_fkey'
  ) THEN
    ALTER TABLE "ConsumableTransaction"
    ADD CONSTRAINT "ConsumableTransaction_recordedByPersonId_fkey"
    FOREIGN KEY ("recordedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsumableTransaction_eventId_fkey'
  ) THEN
    ALTER TABLE "ConsumableTransaction"
    ADD CONSTRAINT "ConsumableTransaction_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
