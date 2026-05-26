-- Arc 19D: Cross-Linking & Operational Graph foundation

-- CreateEnum: OperationalGraphNodeType
CREATE TYPE "OperationalGraphNodeType" AS ENUM (
  'ENTRY',
  'PERSON',
  'TEAM',
  'PROGRAM',
  'SEASON',
  'EVENT',
  'ATTENDANCE_RECORD',
  'FACILITY',
  'FACILITY_RESOURCE',
  'RESOURCE_BOOKING',
  'GEAR_ITEM',
  'GEAR_ASSIGNMENT',
  'GEAR_CHECKOUT',
  'GEAR_MAINTENANCE_LOG',
  'CONSUMABLE_TRANSACTION',
  'FOLLOW_UP_TASK',
  'OBSERVATION_NOTE',
  'ROSTER_MEMBERSHIP',
  'ATHLETE_GUARDIAN_RELATIONSHIP'
);

-- CreateEnum: OperationalRelationshipType
CREATE TYPE "OperationalRelationshipType" AS ENUM (
  'RELATED_TO',
  'BLOCKED_BY',
  'FOLLOW_UP_TO',
  'CREATED_FROM',
  'IMPACTS',
  'ASSIGNED_FOR',
  'OBSERVED_DURING',
  'READINESS_FOR'
);

-- CreateTable: OperationalRelationship
CREATE TABLE "OperationalRelationship" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fromNodeType" "OperationalGraphNodeType" NOT NULL,
  "fromNodeId" TEXT NOT NULL,
  "toNodeType" "OperationalGraphNodeType" NOT NULL,
  "toNodeId" TEXT NOT NULL,
  "relationshipType" "OperationalRelationshipType" NOT NULL,
  "createdByPersonId" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "OperationalRelationship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalRelationship_organizationId_fromNodeType_fromNodeId_toNodeType_toNodeId_relationshipType_key"
  ON "OperationalRelationship"("organizationId", "fromNodeType", "fromNodeId", "toNodeType", "toNodeId", "relationshipType");
CREATE INDEX "OperationalRelationship_organizationId_fromNodeType_fromNodeId_removedAt_idx"
  ON "OperationalRelationship"("organizationId", "fromNodeType", "fromNodeId", "removedAt");
CREATE INDEX "OperationalRelationship_organizationId_toNodeType_toNodeId_removedAt_idx"
  ON "OperationalRelationship"("organizationId", "toNodeType", "toNodeId", "removedAt");
CREATE INDEX "OperationalRelationship_organizationId_relationshipType_createdAt_idx"
  ON "OperationalRelationship"("organizationId", "relationshipType", "createdAt");

ALTER TABLE "OperationalRelationship"
  ADD CONSTRAINT "OperationalRelationship_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalRelationship"
  ADD CONSTRAINT "OperationalRelationship_createdByPersonId_fkey"
  FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
