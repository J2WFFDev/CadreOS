-- Arc 24D.5 — Decision Entry Structured Template Model
-- Additive migration introducing generic EntryTypePayload storage for type-specific metadata.

CREATE TABLE IF NOT EXISTS "EntryTypePayload" (
    "id"             TEXT        NOT NULL,
    "organizationId" TEXT        NOT NULL,
    "entryId"        TEXT        NOT NULL,
    "entryType"      "EntryType" NOT NULL,
    "payloadJson"    TEXT        NOT NULL,
    "isActive"       BOOLEAN     NOT NULL DEFAULT true,
    "archivedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryTypePayload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntryTypePayload_entryId_entryType_key"
  ON "EntryTypePayload"("entryId", "entryType");

CREATE INDEX IF NOT EXISTS "EntryTypePayload_organizationId_entryType_isActive_updatedAt_idx"
  ON "EntryTypePayload"("organizationId", "entryType", "isActive", "updatedAt");

CREATE INDEX IF NOT EXISTS "EntryTypePayload_organizationId_entryId_idx"
  ON "EntryTypePayload"("organizationId", "entryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryTypePayload_organizationId_fkey'
  ) THEN
    ALTER TABLE "EntryTypePayload"
      ADD CONSTRAINT "EntryTypePayload_organizationId_fkey"
      FOREIGN KEY ("organizationId")
      REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryTypePayload_entryId_fkey'
  ) THEN
    ALTER TABLE "EntryTypePayload"
      ADD CONSTRAINT "EntryTypePayload_entryId_fkey"
      FOREIGN KEY ("entryId")
      REFERENCES "Entry"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
