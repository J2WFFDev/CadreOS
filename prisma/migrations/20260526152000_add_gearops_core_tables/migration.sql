-- Ensure required GearOps enums exist
DO $$
BEGIN
  CREATE TYPE "GearInventoryType" AS ENUM ('DURABLE', 'CONSUMABLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearItemLifecycleStatus" AS ENUM ('ACTIVE', 'ASSIGNED', 'CHECKED_OUT', 'MAINTENANCE', 'QUARANTINED', 'RESERVED', 'RETIRED', 'LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearConditionStatus" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'RETIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventoryOwnershipType" AS ENUM ('ORGANIZATION_OWNED', 'PERSONALLY_OWNED', 'LOANED_IN', 'LOANED_OUT', 'DONATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventoryReadinessState" AS ENUM ('READY', 'NEEDS_INSPECTION', 'MAINTENANCE_REQUIRED', 'NOT_READY', 'DECOMMISSIONED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'RETURNED', 'TRANSFERRED', 'CANCELLED', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearCheckoutStatus" AS ENUM ('OPEN', 'RETURNED', 'OVERDUE', 'LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create dependency table used by GearItem
CREATE TABLE IF NOT EXISTS "GearCategory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "inventoryType" "GearInventoryType" NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearCategory_pkey" PRIMARY KEY ("id")
);

-- Create GearOps core tables
CREATE TABLE IF NOT EXISTS "GearItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "programId" TEXT,
  "gearCategoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "inventoryType" "GearInventoryType" NOT NULL,
  "sku" TEXT,
  "serialNumber" TEXT,
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "quantityMin" INTEGER,
  "lifecycleStatus" "GearItemLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "conditionStatus" "GearConditionStatus",
  "ownershipType" "InventoryOwnershipType",
  "readinessState" "InventoryReadinessState",
  "locationId" TEXT,
  "barcodeValue" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "gearItemId" TEXT NOT NULL,
  "assignedToPersonId" TEXT,
  "assignedToTeamId" TEXT,
  "assignedToEventId" TEXT,
  "assignedByPersonId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "status" "GearAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearCheckout" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "gearItemId" TEXT NOT NULL,
  "eventId" TEXT,
  "checkedOutById" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "returnedById" TEXT,
  "receivedById" TEXT,
  "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "status" "GearCheckoutStatus" NOT NULL DEFAULT 'OPEN',
  "conditionOnReturn" "GearConditionStatus",
  "purposeNotes" TEXT,
  "returnNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearCheckout_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "GearCategory_organizationId_inventoryType_idx"
ON "GearCategory"("organizationId", "inventoryType");
CREATE UNIQUE INDEX IF NOT EXISTS "GearCategory_organizationId_name_key"
ON "GearCategory"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "GearItem_organizationId_gearCategoryId_idx"
ON "GearItem"("organizationId", "gearCategoryId");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_programId_idx"
ON "GearItem"("organizationId", "programId");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_inventoryType_lifecycleStatus_idx"
ON "GearItem"("organizationId", "inventoryType", "lifecycleStatus");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_locationId_idx"
ON "GearItem"("organizationId", "locationId");
CREATE INDEX IF NOT EXISTS "GearItem_organizationId_readinessState_idx"
ON "GearItem"("organizationId", "readinessState");
CREATE UNIQUE INDEX IF NOT EXISTS "GearItem_organizationId_serialNumber_key"
ON "GearItem"("organizationId", "serialNumber");

CREATE INDEX IF NOT EXISTS "GearAssignment_organizationId_gearItemId_status_idx"
ON "GearAssignment"("organizationId", "gearItemId", "status");
CREATE INDEX IF NOT EXISTS "GearAssignment_organizationId_assignedToPersonId_status_idx"
ON "GearAssignment"("organizationId", "assignedToPersonId", "status");
CREATE INDEX IF NOT EXISTS "GearAssignment_organizationId_assignedToTeamId_status_idx"
ON "GearAssignment"("organizationId", "assignedToTeamId", "status");
CREATE INDEX IF NOT EXISTS "GearAssignment_organizationId_assignedToEventId_status_idx"
ON "GearAssignment"("organizationId", "assignedToEventId", "status");
CREATE INDEX IF NOT EXISTS "GearAssignment_organizationId_expectedReturnAt_status_idx"
ON "GearAssignment"("organizationId", "expectedReturnAt", "status");

CREATE INDEX IF NOT EXISTS "GearCheckout_organizationId_gearItemId_status_idx"
ON "GearCheckout"("organizationId", "gearItemId", "status");
CREATE INDEX IF NOT EXISTS "GearCheckout_organizationId_checkedOutById_status_idx"
ON "GearCheckout"("organizationId", "checkedOutById", "status");
CREATE INDEX IF NOT EXISTS "GearCheckout_organizationId_issuedById_status_idx"
ON "GearCheckout"("organizationId", "issuedById", "status");
CREATE INDEX IF NOT EXISTS "GearCheckout_organizationId_eventId_status_idx"
ON "GearCheckout"("organizationId", "eventId", "status");
CREATE INDEX IF NOT EXISTS "GearCheckout_organizationId_expectedReturnAt_status_idx"
ON "GearCheckout"("organizationId", "expectedReturnAt", "status");

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCategory_organizationId_fkey'
  ) THEN
    ALTER TABLE "GearCategory"
    ADD CONSTRAINT "GearCategory_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearItem_organizationId_fkey'
  ) THEN
    ALTER TABLE "GearItem"
    ADD CONSTRAINT "GearItem_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearItem_programId_fkey'
  ) THEN
    ALTER TABLE "GearItem"
    ADD CONSTRAINT "GearItem_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearItem_gearCategoryId_fkey'
  ) THEN
    ALTER TABLE "GearItem"
    ADD CONSTRAINT "GearItem_gearCategoryId_fkey"
    FOREIGN KEY ("gearCategoryId") REFERENCES "GearCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearAssignment_organizationId_fkey'
  ) THEN
    ALTER TABLE "GearAssignment"
    ADD CONSTRAINT "GearAssignment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearAssignment_gearItemId_fkey'
  ) THEN
    ALTER TABLE "GearAssignment"
    ADD CONSTRAINT "GearAssignment_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearAssignment_assignedToPersonId_fkey'
  ) THEN
    ALTER TABLE "GearAssignment"
    ADD CONSTRAINT "GearAssignment_assignedToPersonId_fkey"
    FOREIGN KEY ("assignedToPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearAssignment_assignedToTeamId_fkey'
  ) THEN
    ALTER TABLE "GearAssignment"
    ADD CONSTRAINT "GearAssignment_assignedToTeamId_fkey"
    FOREIGN KEY ("assignedToTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearAssignment_assignedToEventId_fkey'
  ) THEN
    ALTER TABLE "GearAssignment"
    ADD CONSTRAINT "GearAssignment_assignedToEventId_fkey"
    FOREIGN KEY ("assignedToEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearAssignment_assignedByPersonId_fkey'
  ) THEN
    ALTER TABLE "GearAssignment"
    ADD CONSTRAINT "GearAssignment_assignedByPersonId_fkey"
    FOREIGN KEY ("assignedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_organizationId_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_gearItemId_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_eventId_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_checkedOutById_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_checkedOutById_fkey"
    FOREIGN KEY ("checkedOutById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_issuedById_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_returnedById_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_returnedById_fkey"
    FOREIGN KEY ("returnedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearCheckout_receivedById_fkey'
  ) THEN
    ALTER TABLE "GearCheckout"
    ADD CONSTRAINT "GearCheckout_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
