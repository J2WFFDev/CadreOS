-- ARC-MEMBER-07: First-class Program Participation foundation

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ProgramParticipationStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "ProgramParticipationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProgramParticipation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "seasonId" TEXT,
  "status" "ProgramParticipationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProgramParticipation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramParticipation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgramParticipation_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramParticipation_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgramParticipation_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProgramParticipation_organizationId_personId_status_idx"
  ON "ProgramParticipation"("organizationId", "personId", "status");
CREATE INDEX IF NOT EXISTS "ProgramParticipation_organizationId_programId_status_idx"
  ON "ProgramParticipation"("organizationId", "programId", "status");
CREATE INDEX IF NOT EXISTS "ProgramParticipation_organizationId_seasonId_idx"
  ON "ProgramParticipation"("organizationId", "seasonId");

-- PostgreSQL allows multiple NULL values in a normal unique index, so evergreen
-- and season-bound participation use separate partial unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramParticipation_evergreen_exact_key"
  ON "ProgramParticipation"("organizationId", "personId", "programId")
  WHERE "seasonId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramParticipation_season_exact_key"
  ON "ProgramParticipation"("organizationId", "personId", "programId", "seasonId")
  WHERE "seasonId" IS NOT NULL;
