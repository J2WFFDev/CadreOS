import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryStatus, EntryType } from "@prisma/client";

import {
  labelForEntryStatus,
  labelForEntryType,
} from "../../lib/operational-feed/render";
import {
  labelForHabitStatus,
} from "../../lib/habits/policy";
import {
  labelForJournalWorkflowStatus,
  labelForJournalVisibility,
  mapEntryStatusToJournalWorkflowStatus,
} from "../../lib/journals/policy";

// ── Unified Entry type coverage ───────────────────────────────────────────────
// All Entry types that exist in EntryType enum must have human-readable labels.

test("all EntryType values have human-readable labels (no raw enum fallback)", () => {
  const allTypes: EntryType[] = [
    "TASK",
    "NOTE",
    "EVENT",
    "DECISION",
    "JOURNAL",
    "HABIT",
    "OBSERVATION",
    "FOLLOW_UP",
    "ACTIVITY",
    "READINESS_ITEM",
  ];
  for (const type of allTypes) {
    const label = labelForEntryType(type);
    // A label equal to the raw enum value means it fell through to the fallback —
    // every known type should have a proper human-readable label.
    assert.notEqual(
      label,
      type,
      `labelForEntryType("${type}") fell back to raw enum value — add a label`,
    );
    assert.ok(label.length > 0, `labelForEntryType("${type}") returned empty string`);
  }
});

// ── Entry status labels are non-empty and human-readable ─────────────────────

test("all EntryStatus values have human-readable labels (no raw enum fallback)", () => {
  const allStatuses: EntryStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "ARCHIVED"];
  for (const status of allStatuses) {
    const label = labelForEntryStatus(status);
    assert.notEqual(
      label,
      status,
      `labelForEntryStatus("${status}") fell back to raw enum value — add a label`,
    );
    assert.ok(label.length > 0, `labelForEntryStatus("${status}") returned empty string`);
  }
});

// ── Habit status labels are non-empty and human-readable ─────────────────────

test("all HabitStatus values have human-readable labels", () => {
  const cases = [
    ["ACTIVE", "Active"],
    ["PAUSED", "Paused"],
    ["ARCHIVED", "Archived"],
  ] as const;
  for (const [status, expected] of cases) {
    assert.equal(labelForHabitStatus(status), expected);
  }
});

// ── Journal workflow status labels are non-empty and human-readable ───────────

test("all JournalWorkflowStatus values have human-readable labels", () => {
  const cases = [
    ["DRAFT", "Draft"],
    ["FINAL", "Final"],
    ["ARCHIVED", "Archived"],
  ] as const;
  for (const [status, expected] of cases) {
    assert.equal(labelForJournalWorkflowStatus(status), expected);
  }
});

// ── Journal visibility labels are non-empty and human-readable ───────────────

test("journal visibility labels are non-empty for all known values", () => {
  const visibilities = ["STAFF_ONLY", "TEAM_STAFF", "ORGANIZATION_SCOPED"] as const;
  for (const v of visibilities) {
    const label = labelForJournalVisibility(v);
    assert.ok(label.length > 0, `labelForJournalVisibility("${v}") returned empty string`);
  }
});

// ── Status mapping: Entry → Journal workflow ──────────────────────────────────
// Journals reuse EntryStatus but map to domain-specific workflow states.
// This test documents and protects that mapping contract.

test("mapEntryStatusToJournalWorkflowStatus maps ARCHIVED → ARCHIVED", () => {
  assert.equal(mapEntryStatusToJournalWorkflowStatus("ARCHIVED"), "ARCHIVED");
});

test("mapEntryStatusToJournalWorkflowStatus maps DONE → FINAL", () => {
  assert.equal(mapEntryStatusToJournalWorkflowStatus("DONE"), "FINAL");
});

test("mapEntryStatusToJournalWorkflowStatus maps OPEN → DRAFT", () => {
  assert.equal(mapEntryStatusToJournalWorkflowStatus("OPEN"), "DRAFT");
});

test("mapEntryStatusToJournalWorkflowStatus maps IN_PROGRESS → DRAFT", () => {
  assert.equal(mapEntryStatusToJournalWorkflowStatus("IN_PROGRESS"), "DRAFT");
});

test("mapEntryStatusToJournalWorkflowStatus maps CANCELLED → DRAFT", () => {
  assert.equal(mapEntryStatusToJournalWorkflowStatus("CANCELLED"), "DRAFT");
});

// ── Operational status vocabulary consistency ─────────────────────────────────
// Documents the cross-domain status philosophy so conflicts are caught by tests.

test("Entry DONE maps to journal FINAL (not DONE) — journal vocabulary is domain-specific", () => {
  const journalStatus = mapEntryStatusToJournalWorkflowStatus("DONE");
  assert.equal(journalStatus, "FINAL");
  assert.notEqual(journalStatus, "DONE");
});

test("Entry ARCHIVED maps to journal ARCHIVED — archive is a shared terminal state", () => {
  assert.equal(mapEntryStatusToJournalWorkflowStatus("ARCHIVED"), "ARCHIVED");
});

test("Habit ACTIVE and Entry OPEN are distinct models — neither shares status enum", () => {
  // Habit uses HabitStatus.ACTIVE; Entry uses EntryStatus.OPEN.
  // This test documents that they are independent and should stay independent.
  assert.equal(labelForHabitStatus("ACTIVE"), "Active");
  assert.equal(labelForEntryStatus("OPEN"), "Open");
  // They render differently by design ("Active" vs "Open").
  assert.notEqual(labelForHabitStatus("ACTIVE"), labelForEntryStatus("OPEN"));
});

test("Habit ARCHIVED, Entry ARCHIVED, and Journal ARCHIVED all render as 'Archived'", () => {
  // Terminal archived state should feel consistent to end users even if the
  // underlying enums differ.
  assert.equal(labelForHabitStatus("ARCHIVED"), "Archived");
  assert.equal(labelForEntryStatus("ARCHIVED"), "Archived");
  assert.equal(labelForJournalWorkflowStatus("ARCHIVED"), "Archived");
});
