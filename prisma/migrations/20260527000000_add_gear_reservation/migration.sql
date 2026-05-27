-- Recovery migration: add GearReservation table and required enums.
-- This is idempotent and non-destructive. The GearReservation model has been
-- in schema.prisma since Arc 20 but was never included in a migration file,
-- causing a P2021 runtime failure in the GearOps dashboard.

DO $$
BEGIN
  CREATE TYPE "GearReservationMode" AS ENUM ('SOFT_HOLD', 'HARD_RESERVATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearReservationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RELEASED', 'CANCELED', 'FULFILLED', 'EXPIRED', 'CONFLICT', 'PENDING_REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearHoldType" AS ENUM ('EVENT_HOLD', 'PERSON_HOLD', 'TEAM_PROGRAM_HOLD', 'MAINTENANCE_HOLD', 'INSPECTION_HOLD', 'STAGING_HOLD', 'ADMIN_HOLD', 'TEMPORARY_OPERATIONAL_HOLD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GearReservationPurpose" AS ENUM ('EVENT', 'PERSON', 'TEAM', 'PROGRAM', 'MAINTENANCE', 'INSPECTION', 'REPAIR', 'STAGING', 'EVENT_PREP', 'ADMIN_REVIEW', 'OPERATIONAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GearReservation" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "gearItemId"          TEXT NOT NULL,
  "programId"           TEXT,
  "reservedForPersonId" TEXT,
  "reservedForTeamId"   TEXT,
  "reservedForEventId"  TEXT,
  "requestedByPersonId" TEXT NOT NULL,
  "approvedByPersonId"  TEXT,
  "releasedByPersonId"  TEXT,
  "mode"                "GearReservationMode"    NOT NULL DEFAULT 'HARD_RESERVATION',
  "holdType"            "GearHoldType",
  "purpose"             "GearReservationPurpose" NOT NULL DEFAULT 'OTHER',
  "status"              "GearReservationStatus"  NOT NULL DEFAULT 'ACTIVE',
  "approvalStatus"      "ApprovalStatus"         NOT NULL DEFAULT 'NOT_REQUIRED',
  "quantityRequested"   INTEGER                  NOT NULL DEFAULT 1,
  "windowStartAt"       TIMESTAMP(3) NOT NULL,
  "windowEndAt"         TIMESTAMP(3) NOT NULL,
  "notes"               TEXT,
  "releaseReason"       TEXT,
  "conflictSummary"     TEXT,
  "releasedAt"          TIMESTAMP(3),
  "fulfilledAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_gearItemId_status_idx"
ON "GearReservation"("organizationId", "gearItemId", "status");

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_windowStartAt_status_idx"
ON "GearReservation"("organizationId", "windowStartAt", "status");

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_windowEndAt_status_idx"
ON "GearReservation"("organizationId", "windowEndAt", "status");

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_reservedForPersonId_status_idx"
ON "GearReservation"("organizationId", "reservedForPersonId", "status");

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_reservedForTeamId_status_idx"
ON "GearReservation"("organizationId", "reservedForTeamId", "status");

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_reservedForEventId_status_idx"
ON "GearReservation"("organizationId", "reservedForEventId", "status");

CREATE INDEX IF NOT EXISTS "GearReservation_organizationId_purpose_status_idx"
ON "GearReservation"("organizationId", "purpose", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_organizationId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_gearItemId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_programId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_reservedForPersonId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_reservedForPersonId_fkey"
    FOREIGN KEY ("reservedForPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_reservedForTeamId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_reservedForTeamId_fkey"
    FOREIGN KEY ("reservedForTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_reservedForEventId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_reservedForEventId_fkey"
    FOREIGN KEY ("reservedForEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_requestedByPersonId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_requestedByPersonId_fkey"
    FOREIGN KEY ("requestedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_approvedByPersonId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_approvedByPersonId_fkey"
    FOREIGN KEY ("approvedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GearReservation_releasedByPersonId_fkey'
  ) THEN
    ALTER TABLE "GearReservation"
    ADD CONSTRAINT "GearReservation_releasedByPersonId_fkey"
    FOREIGN KEY ("releasedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
