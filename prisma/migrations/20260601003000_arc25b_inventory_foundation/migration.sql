-- Arc 25B — GearOps asset and consumable inventory foundation

CREATE TYPE "InventoryOwnerType" AS ENUM (
  'ORGANIZATION',
  'PROGRAM',
  'TEAM',
  'MEMBER',
  'GUARDIAN',
  'SPONSOR',
  'DONOR'
);

CREATE TYPE "InventoryConditionStatus" AS ENUM (
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'NEEDS_MAINTENANCE',
  'OUT_OF_SERVICE'
);

CREATE TYPE "InventoryAvailabilityStatus" AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'CHECKED_OUT',
  'INSPECTION_NEEDED',
  'MAINTENANCE',
  'RETIRED'
);

ALTER TABLE "GearItem"
  ADD COLUMN "manufacturer" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "qrCodeValue" TEXT,
  ADD COLUMN "unitType" TEXT,
  ADD COLUMN "inventoryCondition" "InventoryConditionStatus",
  ADD COLUMN "availabilityStatus" "InventoryAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "ownerType" "InventoryOwnerType",
  ADD COLUMN "ownerRecordType" TEXT,
  ADD COLUMN "ownerRecordId" TEXT,
  ADD COLUMN "ownershipNotes" TEXT,
  ADD COLUMN "custodyPersonId" TEXT,
  ADD COLUMN "storageLocationText" TEXT;

ALTER TABLE "GearItem"
  ADD CONSTRAINT "GearItem_custodyPersonId_fkey"
  FOREIGN KEY ("custodyPersonId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GearItem_organizationId_custodyPersonId_idx" ON "GearItem"("organizationId", "custodyPersonId");
CREATE INDEX "GearItem_organizationId_ownerType_idx" ON "GearItem"("organizationId", "ownerType");
CREATE INDEX "GearItem_organizationId_availabilityStatus_idx" ON "GearItem"("organizationId", "availabilityStatus");
CREATE INDEX "GearItem_organizationId_inventoryCondition_idx" ON "GearItem"("organizationId", "inventoryCondition");
