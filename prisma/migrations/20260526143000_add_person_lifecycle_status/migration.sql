-- Ensure MemberLifecycleStatus enum exists
DO $$
BEGIN
  CREATE TYPE "MemberLifecycleStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALUMNI');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add lifecycleStatus safely for existing Person rows
ALTER TABLE "Person"
ADD COLUMN IF NOT EXISTS "lifecycleStatus" "MemberLifecycleStatus";

ALTER TABLE "Person"
ALTER COLUMN "lifecycleStatus" SET DEFAULT 'ACTIVE';

UPDATE "Person"
SET "lifecycleStatus" = 'ACTIVE'
WHERE "lifecycleStatus" IS NULL;

ALTER TABLE "Person"
ALTER COLUMN "lifecycleStatus" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Person_organizationId_lifecycleStatus_idx"
ON "Person"("organizationId", "lifecycleStatus");
