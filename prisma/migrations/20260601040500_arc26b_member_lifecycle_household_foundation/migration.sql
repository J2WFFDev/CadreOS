-- Arc 26B: Member lifecycle and household foundation
ALTER TYPE "MemberLifecycleStatus" ADD VALUE IF NOT EXISTS 'APPLICANT';
ALTER TYPE "MemberLifecycleStatus" ADD VALUE IF NOT EXISTS 'FORMER';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'GuardianRelationshipRole'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "GuardianRelationshipRole" AS ENUM ('PRIMARY_GUARDIAN', 'SECONDARY_GUARDIAN', 'EMERGENCY_CONTACT');
  END IF;
END
$$;

ALTER TABLE "Person"
  ADD COLUMN IF NOT EXISTS "lifecycleStatusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lifecycleStatusReason" TEXT;

UPDATE "Person"
SET "lifecycleStatusChangedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "lifecycleStatusChangedAt" IS NULL;

ALTER TABLE "AthleteGuardianRelationship"
  ADD COLUMN IF NOT EXISTS "guardianRole" "GuardianRelationshipRole" NOT NULL DEFAULT 'PRIMARY_GUARDIAN';
