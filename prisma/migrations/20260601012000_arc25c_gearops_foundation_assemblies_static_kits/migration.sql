-- Arc 25C: GearOps foundation audit, assemblies, and static kit enhancements

ALTER TABLE "InventoryKit"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "GearReservation"
  ADD COLUMN "inventoryKitId" TEXT;

CREATE TABLE "GearAssembly" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parentGearItemId" TEXT NOT NULL,
  "childGearItemId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GearAssembly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GearAssembly_organizationId_parentGearItemId_childGearItemId_key"
  ON "GearAssembly"("organizationId", "parentGearItemId", "childGearItemId");

CREATE INDEX "GearAssembly_organizationId_parentGearItemId_isActive_idx"
  ON "GearAssembly"("organizationId", "parentGearItemId", "isActive");

CREATE INDEX "GearAssembly_organizationId_childGearItemId_isActive_idx"
  ON "GearAssembly"("organizationId", "childGearItemId", "isActive");

CREATE INDEX "GearReservation_organizationId_inventoryKitId_status_idx"
  ON "GearReservation"("organizationId", "inventoryKitId", "status");

ALTER TABLE "GearReservation"
  ADD CONSTRAINT "GearReservation_inventoryKitId_fkey"
  FOREIGN KEY ("inventoryKitId") REFERENCES "InventoryKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GearAssembly"
  ADD CONSTRAINT "GearAssembly_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GearAssembly"
  ADD CONSTRAINT "GearAssembly_parentGearItemId_fkey"
  FOREIGN KEY ("parentGearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GearAssembly"
  ADD CONSTRAINT "GearAssembly_childGearItemId_fkey"
  FOREIGN KEY ("childGearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
