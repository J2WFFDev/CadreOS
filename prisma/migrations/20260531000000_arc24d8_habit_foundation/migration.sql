-- Arc 24D.8: Habit / Recurring Task Foundation
-- Additive migration — no existing tables are dropped.
-- Extends Arc 23D Habit schema with:
--   - COMPLETED value in HabitStatus enum
--   - HabitTrackingMode enum
--   - Tracking and derived/placeholder columns on Habit
--   - interval column on HabitSchedule
--   - completedBy, countValue, updatedAt on HabitCompletion
--   - HabitActivity table for activity-feed events

-- ── Enum: HabitStatus — add COMPLETED ────────────────────────────────────────

ALTER TYPE "HabitStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- ── Enum: HabitTrackingMode (new) ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "HabitTrackingMode" AS ENUM ('CHECKOFF', 'COUNT', 'NOTES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Habit: new columns ────────────────────────────────────────────────────────

ALTER TABLE "Habit"
  ADD COLUMN IF NOT EXISTS "completedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trackingMode"         "HabitTrackingMode" NOT NULL DEFAULT 'CHECKOFF',
  ADD COLUMN IF NOT EXISTS "targetCount"          INTEGER,
  ADD COLUMN IF NOT EXISTS "targetUnit"           TEXT,
  ADD COLUMN IF NOT EXISTS "allowCompletionNote"  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "nextOccurrenceDate"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastCompletedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastOccurrenceDate"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "longestStreak"        INTEGER,
  ADD COLUMN IF NOT EXISTS "completionRate"       DOUBLE PRECISION;

-- ── HabitSchedule: interval placeholder ──────────────────────────────────────

ALTER TABLE "HabitSchedule"
  ADD COLUMN IF NOT EXISTS "interval" INTEGER;

-- ── HabitCompletion: completedBy, countValue, updatedAt ──────────────────────

ALTER TABLE "HabitCompletion"
  ADD COLUMN IF NOT EXISTS "completedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "countValue"  INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── HabitActivity (new table) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HabitActivity" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "habitId"        TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "actorPersonId"  TEXT,
    "metadata"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HabitActivity_organizationId_createdAt_idx"
    ON "HabitActivity"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "HabitActivity_habitId_createdAt_idx"
    ON "HabitActivity"("habitId", "createdAt");

ALTER TABLE "HabitActivity"
  DROP CONSTRAINT IF EXISTS "HabitActivity_organizationId_fkey",
  ADD CONSTRAINT "HabitActivity_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT IF EXISTS "HabitActivity_habitId_fkey",
  ADD CONSTRAINT "HabitActivity_habitId_fkey"
    FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
