-- CreateEnum
CREATE TYPE "EventGearPlanStatus" AS ENUM ('DRAFT', 'READY_TO_STAGE', 'STAGED', 'DEPLOYED', 'RECOVERING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EventGearRequirementType" AS ENUM ('REQUIRED', 'OPTIONAL', 'SUPPORT');

-- CreateTable
CREATE TABLE "EventGearPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "EventGearPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "stagingLocationId" TEXT,
    "recoveryLocationId" TEXT,
    "deploymentLocationText" TEXT,
    "checklistNotes" TEXT,
    "stagingNotes" TEXT,
    "recoveryNotes" TEXT,
    "readinessCheckedAt" TIMESTAMP(3),
    "preparedByPersonId" TEXT,
    "preparedAt" TIMESTAMP(3),
    "createdByPersonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGearPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGearRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "gearCategoryId" TEXT,
    "label" TEXT NOT NULL,
    "requirementType" "EventGearRequirementType" NOT NULL DEFAULT 'REQUIRED',
    "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGearRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGearAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "gearItemId" TEXT NOT NULL,
    "assignedByPersonId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stagedByPersonId" TEXT,
    "stagedAt" TIMESTAMP(3),
    "stagedFromLocationId" TEXT,
    "stagedToLocationId" TEXT,
    "recoveredByPersonId" TEXT,
    "recoveredAt" TIMESTAMP(3),
    "recoveredToLocationId" TEXT,
    "conditionOnRecovery" "GearConditionStatus",
    "maintenanceFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recoveryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGearAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventGearPlan_eventId_key" ON "EventGearPlan"("eventId");

-- CreateIndex
CREATE INDEX "EventGearPlan_organizationId_status_idx" ON "EventGearPlan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EventGearPlan_organizationId_eventId_idx" ON "EventGearPlan"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "EventGearRequirement_organizationId_planId_requirementType_idx" ON "EventGearRequirement"("organizationId", "planId", "requirementType");

-- CreateIndex
CREATE INDEX "EventGearRequirement_organizationId_gearCategoryId_idx" ON "EventGearRequirement"("organizationId", "gearCategoryId");

-- CreateIndex
CREATE INDEX "EventGearAssignment_organizationId_planId_assignedAt_idx" ON "EventGearAssignment"("organizationId", "planId", "assignedAt");

-- CreateIndex
CREATE INDEX "EventGearAssignment_organizationId_requirementId_assignedAt_idx" ON "EventGearAssignment"("organizationId", "requirementId", "assignedAt");

-- CreateIndex
CREATE INDEX "EventGearAssignment_organizationId_gearItemId_assignedAt_idx" ON "EventGearAssignment"("organizationId", "gearItemId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventGearAssignment_planId_gearItemId_key" ON "EventGearAssignment"("planId", "gearItemId");

-- AddForeignKey
ALTER TABLE "EventGearPlan" ADD CONSTRAINT "EventGearPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearPlan" ADD CONSTRAINT "EventGearPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearPlan" ADD CONSTRAINT "EventGearPlan_stagingLocationId_fkey" FOREIGN KEY ("stagingLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearPlan" ADD CONSTRAINT "EventGearPlan_recoveryLocationId_fkey" FOREIGN KEY ("recoveryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearPlan" ADD CONSTRAINT "EventGearPlan_preparedByPersonId_fkey" FOREIGN KEY ("preparedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearPlan" ADD CONSTRAINT "EventGearPlan_createdByPersonId_fkey" FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearRequirement" ADD CONSTRAINT "EventGearRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearRequirement" ADD CONSTRAINT "EventGearRequirement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventGearPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearRequirement" ADD CONSTRAINT "EventGearRequirement_gearCategoryId_fkey" FOREIGN KEY ("gearCategoryId") REFERENCES "GearCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EventGearPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "EventGearRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_assignedByPersonId_fkey" FOREIGN KEY ("assignedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_stagedByPersonId_fkey" FOREIGN KEY ("stagedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_recoveredByPersonId_fkey" FOREIGN KEY ("recoveredByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_stagedFromLocationId_fkey" FOREIGN KEY ("stagedFromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_stagedToLocationId_fkey" FOREIGN KEY ("stagedToLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGearAssignment" ADD CONSTRAINT "EventGearAssignment_recoveredToLocationId_fkey" FOREIGN KEY ("recoveredToLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

