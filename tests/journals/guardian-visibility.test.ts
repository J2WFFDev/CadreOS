/**
 * Arc 23E — Guardian-Safe Visibility and Feed Integration
 *
 * Unit tests for lib/journals/guardian-visibility.ts
 *
 * Covers:
 * - isJournalVisibleToGuardian — relationship-scoped visibility gating
 * - toGuardianSafeJournalSummary — safe summary derivation (no body text)
 * - toGuardianSafeHabitSummary — safe habit summary derivation (no notes)
 * - deriveGuardianAthleteJournalHabitSummary — full summary aggregation
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryStatus, EntryVisibility } from "@prisma/client";

import {
  deriveGuardianAthleteJournalHabitSummary,
  isJournalVisibleToGuardian,
  toGuardianSafeHabitSummary,
  toGuardianSafeJournalSummary,
  type GuardianHabitRecord,
  type GuardianJournalRecord,
} from "../../lib/journals/guardian-visibility";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function buildJournal(input?: Partial<GuardianJournalRecord>): GuardianJournalRecord {
  return {
    id: "journal-1",
    title: "Athlete reflection on match day",
    status: EntryStatus.DONE,
    visibility: EntryVisibility.ORGANIZATION_SCOPED,
    createdByPersonId: "athlete-1",
    updatedAt: new Date("2026-05-01T12:00:00Z"),
    ...input,
  };
}

function buildHabit(input?: Partial<GuardianHabitRecord>): GuardianHabitRecord {
  return {
    id: "habit-1",
    title: "Morning stretch",
    status: "ACTIVE",
    athletePersonId: "athlete-1",
    completionCount: 10,
    currentStreak: 5,
    ...input,
  };
}

// ── isJournalVisibleToGuardian ────────────────────────────────────────────────

test("submitted ORGANIZATION_SCOPED journal is visible to linked guardian", () => {
  const journal = buildJournal();
  const linkedIds = new Set(["athlete-1"]);
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), true);
});

test("draft journal is not visible to guardian regardless of visibility policy", () => {
  const journal = buildJournal({ status: EntryStatus.OPEN });
  const linkedIds = new Set(["athlete-1"]);
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), false);
});

test("IN_PROGRESS journal is not visible to guardian", () => {
  const journal = buildJournal({ status: EntryStatus.IN_PROGRESS });
  const linkedIds = new Set(["athlete-1"]);
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), false);
});

test("submitted STAFF_ONLY journal is not visible to guardian", () => {
  const journal = buildJournal({ visibility: EntryVisibility.STAFF_ONLY });
  const linkedIds = new Set(["athlete-1"]);
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), false);
});

test("submitted TEAM_STAFF journal is not visible to guardian", () => {
  const journal = buildJournal({ visibility: EntryVisibility.TEAM_STAFF });
  const linkedIds = new Set(["athlete-1"]);
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), false);
});

test("unrelated guardian cannot see ORGANIZATION_SCOPED submitted journal of unlinked athlete", () => {
  const journal = buildJournal({ createdByPersonId: "athlete-2" });
  const linkedIds = new Set(["athlete-1"]); // guardian is NOT linked to athlete-2
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), false);
});

test("empty linked set means no journals are visible to guardian", () => {
  const journal = buildJournal();
  const linkedIds = new Set<string>();
  assert.equal(isJournalVisibleToGuardian(journal, linkedIds), false);
});

// ── toGuardianSafeJournalSummary ──────────────────────────────────────────────

test("toGuardianSafeJournalSummary returns metadata without body text field", () => {
  const journal = buildJournal();
  const summary = toGuardianSafeJournalSummary(journal);
  assert.equal(summary.id, "journal-1");
  assert.equal(summary.displayTitle, "Athlete reflection on match day");
  assert.equal(summary.statusLabel, "Submitted");
  assert.deepStrictEqual(summary.updatedAt, new Date("2026-05-01T12:00:00Z"));
  // No body text field
  assert.equal("content" in summary, false);
  assert.equal("body" in summary, false);
});

test("toGuardianSafeJournalSummary labels ARCHIVED status correctly", () => {
  const journal = buildJournal({ status: EntryStatus.ARCHIVED });
  const summary = toGuardianSafeJournalSummary(journal);
  assert.equal(summary.statusLabel, "Archived");
});

// ── toGuardianSafeHabitSummary ────────────────────────────────────────────────

test("toGuardianSafeHabitSummary returns safe summary with count and streak", () => {
  const habit = buildHabit();
  const summary = toGuardianSafeHabitSummary(habit);
  assert.equal(summary.id, "habit-1");
  assert.equal(summary.title, "Morning stretch");
  assert.equal(summary.statusLabel, "Active");
  assert.equal(summary.completionCount, 10);
  assert.equal(summary.currentStreak, 5);
  // No notes field
  assert.equal("note" in summary, false);
  assert.equal("notes" in summary, false);
});

test("toGuardianSafeHabitSummary labels PAUSED status correctly", () => {
  const habit = buildHabit({ status: "PAUSED" });
  const summary = toGuardianSafeHabitSummary(habit);
  assert.equal(summary.statusLabel, "Paused");
});

test("toGuardianSafeHabitSummary labels ARCHIVED status correctly", () => {
  const habit = buildHabit({ status: "ARCHIVED" });
  const summary = toGuardianSafeHabitSummary(habit);
  assert.equal(summary.statusLabel, "Archived");
});

// ── deriveGuardianAthleteJournalHabitSummary ──────────────────────────────────

test("summary includes visible journals and habit summaries for linked athlete", () => {
  const journals = [
    buildJournal({ id: "j1", status: EntryStatus.DONE, visibility: EntryVisibility.ORGANIZATION_SCOPED }),
    buildJournal({ id: "j2", status: EntryStatus.DONE, visibility: EntryVisibility.ORGANIZATION_SCOPED }),
  ];
  const habits = [buildHabit({ id: "h1" })];
  const linkedIds = new Set(["athlete-1"]);

  const summary = deriveGuardianAthleteJournalHabitSummary("athlete-1", journals, habits, linkedIds);

  assert.equal(summary.submittedJournalCount, 2);
  assert.equal(summary.archivedJournalCount, 0);
  assert.equal(summary.recentJournals.length, 2);
  assert.equal(summary.activeHabitCount, 1);
  assert.equal(summary.habits.length, 1);
});

test("summary excludes draft journals (not visible to guardian)", () => {
  const journals = [
    buildJournal({ id: "j1", status: EntryStatus.OPEN, visibility: EntryVisibility.ORGANIZATION_SCOPED }),
    buildJournal({ id: "j2", status: EntryStatus.DONE, visibility: EntryVisibility.ORGANIZATION_SCOPED }),
  ];
  const habits: GuardianHabitRecord[] = [];
  const linkedIds = new Set(["athlete-1"]);

  const summary = deriveGuardianAthleteJournalHabitSummary("athlete-1", journals, habits, linkedIds);
  assert.equal(summary.submittedJournalCount, 1); // only the DONE one
  assert.equal(summary.recentJournals.length, 1);
});

test("summary excludes STAFF_ONLY journals even when submitted", () => {
  const journals = [
    buildJournal({ id: "j1", status: EntryStatus.DONE, visibility: EntryVisibility.STAFF_ONLY }),
  ];
  const habits: GuardianHabitRecord[] = [];
  const linkedIds = new Set(["athlete-1"]);

  const summary = deriveGuardianAthleteJournalHabitSummary("athlete-1", journals, habits, linkedIds);
  assert.equal(summary.submittedJournalCount, 0);
  assert.equal(summary.recentJournals.length, 0);
});

test("unlinked athlete returns empty summary — guardian cannot access unrelated athletes", () => {
  const journals = [buildJournal({ createdByPersonId: "athlete-2" })];
  const habits = [buildHabit({ athletePersonId: "athlete-2" })];
  const linkedIds = new Set(["athlete-1"]); // NOT linked to athlete-2

  const summary = deriveGuardianAthleteJournalHabitSummary("athlete-2", journals, habits, linkedIds);

  assert.equal(summary.submittedJournalCount, 0);
  assert.equal(summary.archivedJournalCount, 0);
  assert.equal(summary.recentJournals.length, 0);
  assert.equal(summary.activeHabitCount, 0);
  assert.equal(summary.habits.length, 0);
});

test("recentJournals is capped at 10 items sorted by most recent first", () => {
  const journals = Array.from({ length: 15 }, (_, i) => buildJournal({
    id: `j${i}`,
    updatedAt: new Date(`2026-0${(i % 9) + 1}-01T00:00:00Z`),
  }));
  const linkedIds = new Set(["athlete-1"]);

  const summary = deriveGuardianAthleteJournalHabitSummary("athlete-1", journals, [], linkedIds);
  assert.equal(summary.recentJournals.length, 10);

  // Most recent first
  for (let i = 0; i < summary.recentJournals.length - 1; i++) {
    const a = summary.recentJournals[i].updatedAt.getTime();
    const b = summary.recentJournals[i + 1].updatedAt.getTime();
    assert.ok(a >= b, "recentJournals should be sorted most-recent-first");
  }
});

test("activeHabitCount only counts ACTIVE habits", () => {
  const habits = [
    buildHabit({ id: "h1", status: "ACTIVE" }),
    buildHabit({ id: "h2", status: "PAUSED" }),
    buildHabit({ id: "h3", status: "ARCHIVED" }),
  ];
  const linkedIds = new Set(["athlete-1"]);

  const summary = deriveGuardianAthleteJournalHabitSummary("athlete-1", [], habits, linkedIds);
  assert.equal(summary.activeHabitCount, 1);
  assert.equal(summary.habits.length, 3); // all habits appear in the summary list
});
