-- Arc 25B.1 — GearOps inventory foundation reconciliation

CREATE TYPE "InventoryConditionStatus" AS ENUM (
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'NEEDS_MAINTENANCE',
  'OUT_OF_SERVICE'
);

ALTER TABLE "GearItem"
  ADD COLUMN "manufacturer" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "qrCodeValue" TEXT,
  ADD COLUMN "unitType" TEXT,
  ADD COLUMN "inventoryCondition" "InventoryConditionStatus",
  ADD COLUMN "storageLocationText" TEXT;

CREATE INDEX "GearItem_organizationId_inventoryCondition_idx" ON "GearItem"("organizationId", "inventoryCondition");
