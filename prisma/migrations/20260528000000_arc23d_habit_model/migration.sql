-- Arc 23D: Habit Model, Recurrence, and Completion Tracking
-- Additive migration — no existing tables are modified or dropped.

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "HabitFrequency" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HabitStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Habit ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Habit" (
    "id"                TEXT NOT NULL,
    "organizationId"    TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "description"       TEXT,
    "athletePersonId"   TEXT NOT NULL,
    "assignedToTeamId"  TEXT,
    "status"            "HabitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByPersonId" TEXT NOT NULL,
    "archivedAt"        TIMESTAMP(3),
    "pausedAt"          TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- ── HabitSchedule ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HabitSchedule" (
    "id"         TEXT NOT NULL,
    "habitId"    TEXT NOT NULL,
    "frequency"  "HabitFrequency" NOT NULL,
    "daysOfWeek" TEXT,
    "startDate"  TIMESTAMP(3) NOT NULL,
    "endDate"    TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitSchedule_pkey" PRIMARY KEY ("id")
);

-- ── HabitCompletion ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HabitCompletion" (
    "id"              TEXT NOT NULL,
    "habitId"         TEXT NOT NULL,
    "athletePersonId" TEXT NOT NULL,
    "completedOn"     TIMESTAMP(3) NOT NULL,
    "note"            TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Habit" ADD CONSTRAINT "Habit_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Habit" ADD CONSTRAINT "Habit_athletePersonId_fkey"
    FOREIGN KEY ("athletePersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Habit" ADD CONSTRAINT "Habit_assignedToTeamId_fkey"
    FOREIGN KEY ("assignedToTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Habit" ADD CONSTRAINT "Habit_createdByPersonId_fkey"
    FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HabitSchedule" ADD CONSTRAINT "HabitSchedule_habitId_fkey"
    FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey"
    FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_athletePersonId_fkey"
    FOREIGN KEY ("athletePersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Unique constraints ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "HabitCompletion_habitId_completedOn_key"
  ON "HabitCompletion"("habitId", "completedOn");

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Habit_organizationId_athletePersonId_status_idx"
  ON "Habit"("organizationId", "athletePersonId", "status");

CREATE INDEX IF NOT EXISTS "Habit_organizationId_status_createdAt_idx"
  ON "Habit"("organizationId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Habit_organizationId_assignedToTeamId_idx"
  ON "Habit"("organizationId", "assignedToTeamId");

CREATE INDEX IF NOT EXISTS "Habit_organizationId_createdByPersonId_idx"
  ON "Habit"("organizationId", "createdByPersonId");

CREATE INDEX IF NOT EXISTS "HabitSchedule_habitId_idx"
  ON "HabitSchedule"("habitId");

CREATE INDEX IF NOT EXISTS "HabitCompletion_habitId_completedOn_idx"
  ON "HabitCompletion"("habitId", "completedOn");

CREATE INDEX IF NOT EXISTS "HabitCompletion_athletePersonId_completedOn_idx"
  ON "HabitCompletion"("athletePersonId", "completedOn");
