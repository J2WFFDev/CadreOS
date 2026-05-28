-- Arc 23F: Journal Version History and Trust/Audit Model
-- Additive migration — no existing tables are modified or dropped.

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "JournalVersionChangeType" AS ENUM ('DRAFT_CREATED', 'DRAFT_UPDATED', 'SUBMITTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── JournalVersion ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "JournalVersion" (
    "id"                 TEXT NOT NULL,
    "organizationId"     TEXT NOT NULL,
    "entryId"            TEXT NOT NULL,
    "versionNumber"      INTEGER NOT NULL,
    "changeType"         "JournalVersionChangeType" NOT NULL,
    "titleSnapshot"      TEXT NOT NULL,
    "contentSnapshot"    TEXT,
    "visibilityAtVersion" "EntryVisibility" NOT NULL,
    "statusAtVersion"    "EntryStatus" NOT NULL,
    "fromStatus"         "EntryStatus",
    "toStatus"           "EntryStatus" NOT NULL,
    "capturedByPersonId" TEXT,
    "capturedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReason"       TEXT,

    CONSTRAINT "JournalVersion_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "JournalVersion" ADD CONSTRAINT "JournalVersion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JournalVersion" ADD CONSTRAINT "JournalVersion_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JournalVersion" ADD CONSTRAINT "JournalVersion_capturedByPersonId_fkey"
    FOREIGN KEY ("capturedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Unique constraints ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "JournalVersion_entryId_versionNumber_key"
  ON "JournalVersion"("entryId", "versionNumber");

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "JournalVersion_organizationId_entryId_capturedAt_idx"
  ON "JournalVersion"("organizationId", "entryId", "capturedAt");

CREATE INDEX IF NOT EXISTS "JournalVersion_organizationId_capturedByPersonId_capturedAt_idx"
  ON "JournalVersion"("organizationId", "capturedByPersonId", "capturedAt");
