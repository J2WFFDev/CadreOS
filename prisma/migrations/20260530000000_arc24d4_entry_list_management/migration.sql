-- Arc 24D.4 — Entry List Management and Assignment
-- Additive migration — no existing tables are dropped or modified (except Entry column addition).

-- ── EntryListScope enum ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "EntryListScope" AS ENUM ('PERSONAL', 'ORGANIZATION', 'PROGRAM', 'TEAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── EntryList ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "EntryList" (
    "id"             TEXT        NOT NULL,
    "organizationId" TEXT        NOT NULL,
    "name"           TEXT        NOT NULL,
    "scope"          "EntryListScope" NOT NULL,
    "isInbox"        BOOLEAN     NOT NULL DEFAULT false,
    "isArchived"     BOOLEAN     NOT NULL DEFAULT false,
    "ownerPersonId"  TEXT,
    "programId"      TEXT,
    "teamId"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryList_pkey" PRIMARY KEY ("id")
);

-- Foreign keys for EntryList

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryList_organizationId_fkey'
  ) THEN
    ALTER TABLE "EntryList"
      ADD CONSTRAINT "EntryList_organizationId_fkey"
      FOREIGN KEY ("organizationId")
      REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryList_ownerPersonId_fkey'
  ) THEN
    ALTER TABLE "EntryList"
      ADD CONSTRAINT "EntryList_ownerPersonId_fkey"
      FOREIGN KEY ("ownerPersonId")
      REFERENCES "Person"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryList_programId_fkey'
  ) THEN
    ALTER TABLE "EntryList"
      ADD CONSTRAINT "EntryList_programId_fkey"
      FOREIGN KEY ("programId")
      REFERENCES "Program"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryList_teamId_fkey'
  ) THEN
    ALTER TABLE "EntryList"
      ADD CONSTRAINT "EntryList_teamId_fkey"
      FOREIGN KEY ("teamId")
      REFERENCES "Team"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes for EntryList

CREATE INDEX IF NOT EXISTS "EntryList_organizationId_scope_idx"
  ON "EntryList"("organizationId", "scope");

CREATE INDEX IF NOT EXISTS "EntryList_organizationId_ownerPersonId_idx"
  ON "EntryList"("organizationId", "ownerPersonId");

CREATE INDEX IF NOT EXISTS "EntryList_organizationId_programId_idx"
  ON "EntryList"("organizationId", "programId");

CREATE INDEX IF NOT EXISTS "EntryList_organizationId_teamId_idx"
  ON "EntryList"("organizationId", "teamId");

-- ── Entry: add listId column ──────────────────────────────────────────────────

ALTER TABLE "Entry"
  ADD COLUMN IF NOT EXISTS "listId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Entry_listId_fkey'
  ) THEN
    ALTER TABLE "Entry"
      ADD CONSTRAINT "Entry_listId_fkey"
      FOREIGN KEY ("listId")
      REFERENCES "EntryList"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Entry_organizationId_listId_idx"
  ON "Entry"("organizationId", "listId");
