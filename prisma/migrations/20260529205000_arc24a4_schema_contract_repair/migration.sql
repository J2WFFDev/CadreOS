-- Arc 24A.4 schema contract repair
-- Align database columns/indexes with Prisma fields used by Entry and GearOps detail paths.

ALTER TABLE "Entry"
  ADD COLUMN IF NOT EXISTS "journalPromptId" TEXT,
  ADD COLUMN IF NOT EXISTS "journalAssignmentId" TEXT;

CREATE INDEX IF NOT EXISTS "Entry_organizationId_journalPromptId_idx"
  ON "Entry"("organizationId", "journalPromptId");

CREATE INDEX IF NOT EXISTS "Entry_organizationId_journalAssignmentId_idx"
  ON "Entry"("organizationId", "journalAssignmentId");

DO $$
BEGIN
  IF to_regclass('"JournalPrompt"') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'Entry_journalPromptId_fkey'
    ) THEN
    ALTER TABLE "Entry"
      ADD CONSTRAINT "Entry_journalPromptId_fkey"
      FOREIGN KEY ("journalPromptId")
      REFERENCES "JournalPrompt"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"JournalAssignment"') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'Entry_journalAssignmentId_fkey'
    ) THEN
    ALTER TABLE "Entry"
      ADD CONSTRAINT "Entry_journalAssignmentId_fkey"
      FOREIGN KEY ("journalAssignmentId")
      REFERENCES "JournalAssignment"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "GearItem"
  ADD COLUMN IF NOT EXISTS "assetId" TEXT;

CREATE INDEX IF NOT EXISTS "GearItem_organizationId_assetId_idx"
  ON "GearItem"("organizationId", "assetId");

CREATE UNIQUE INDEX IF NOT EXISTS "GearItem_organizationId_assetId_key"
  ON "GearItem"("organizationId", "assetId");
