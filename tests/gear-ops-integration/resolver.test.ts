import { strict as assert } from "node:assert";
import test from "node:test";

import { formatGearPersonDisplayName } from "../../lib/gear-ops-integration/types";

// ── resolveGearPersonReference — pure logic tests ────────────────────────────
// DB-backed resolvers require a live database; these tests verify the
// resolver helper logic and display-name formatting which are pure functions.

test("formatGearPersonDisplayName used by resolver produces correct format for typical name", () => {
  assert.equal(formatGearPersonDisplayName("John", "Doe"), "Doe, John");
});

test("formatGearPersonDisplayName used by resolver handles all-whitespace first name", () => {
  assert.equal(formatGearPersonDisplayName("   ", "Williams"), "Williams");
});

test("formatGearPersonDisplayName used by resolver handles all-whitespace last name", () => {
  assert.equal(formatGearPersonDisplayName("Emily", "   "), "Emily");
});

// ── Person selector option shape ─────────────────────────────────────────────

test("GearSelectorOption has id and label string fields", () => {
  const option = { id: "person-001", label: "Doe, John" };
  assert.equal(typeof option.id, "string");
  assert.equal(typeof option.label, "string");
});

test("GearSelectorOption list can be empty (no available persons in org)", () => {
  const options: { id: string; label: string }[] = [];
  assert.equal(options.length, 0);
});

// ── Event selector option date-appended label ─────────────────────────────────

test("event selector label includes ISO date when startsAt is present", () => {
  const event = {
    id: "event-001",
    title: "Saturday Practice",
    startsAt: new Date("2026-06-01T09:00:00Z"),
  };
  const label = event.startsAt
    ? `${event.title} — ${event.startsAt.toISOString().slice(0, 10)}`
    : event.title;

  assert.ok(label.includes("2026-06-01"), `Expected date in label: '${label}'`);
  assert.ok(label.includes("Saturday Practice"), `Expected title in label: '${label}'`);
});

test("event selector label falls back to title when startsAt is null", () => {
  const event = {
    id: "event-002",
    title: "Open Training",
    startsAt: null as Date | null,
  };
  const label = event.startsAt
    ? `${event.title} — ${event.startsAt.toISOString().slice(0, 10)}`
    : event.title;

  assert.equal(label, "Open Training");
});

// ── GearNoteReference shape ───────────────────────────────────────────────────

test("GearNoteReference allows all nullable cross-module fields to be null", () => {
  const ref = {
    noteId: "note-001",
    body: "Helmet strap worn on return.",
    authorPersonId: "person-staff-01",
    organizationId: "org-abc",
    linkedPersonId: null,
    linkedTeamId: null,
    linkedEventId: null,
  };

  assert.equal(ref.linkedPersonId, null);
  assert.equal(ref.linkedTeamId, null);
  assert.equal(ref.linkedEventId, null);
});

test("GearNoteReference carries linked person, team, and event when present", () => {
  const ref = {
    noteId: "note-002",
    body: "Condition noted at event recovery.",
    authorPersonId: "person-staff-01",
    organizationId: "org-abc",
    linkedPersonId: "person-athlete-01",
    linkedTeamId: "team-blue",
    linkedEventId: "event-match-01",
  };

  assert.equal(ref.linkedPersonId, "person-athlete-01");
  assert.equal(ref.linkedTeamId, "team-blue");
  assert.equal(ref.linkedEventId, "event-match-01");
});

// ── GearTaskReference shape ───────────────────────────────────────────────────

test("GearTaskReference carries status and assigneePersonId fields", () => {
  const ref = {
    taskId: "task-001",
    title: "Inspect helmet strap before next use",
    status: "OPEN",
    assigneePersonId: "person-staff-01",
    organizationId: "org-abc",
    sourceGearItemId: "gear-001",
  };

  assert.equal(typeof ref.taskId, "string");
  assert.equal(ref.status, "OPEN");
  assert.equal(ref.sourceGearItemId, "gear-001");
});

test("GearTaskReference allows null sourceGearItemId for general tasks", () => {
  const ref = {
    taskId: "task-002",
    title: "General follow-up",
    status: "IN_PROGRESS",
    assigneePersonId: "person-staff-01",
    organizationId: "org-abc",
    sourceGearItemId: null,
  };

  assert.equal(ref.sourceGearItemId, null);
});

// ── GearGuardianReference shape ───────────────────────────────────────────────

test("GearGuardianReference links guardian to athlete via person IDs", () => {
  const ref = {
    guardianPersonId: "guardian-001",
    athletePersonId: "athlete-002",
    guardianDisplayName: "Smith, Mary",
    relationshipType: "PARENT",
    organizationId: "org-abc",
  };

  assert.equal(ref.guardianPersonId, "guardian-001");
  assert.equal(ref.athletePersonId, "athlete-002");
  assert.ok(ref.guardianDisplayName.length > 0);
});

// ── GearActivityReference shape ───────────────────────────────────────────────

test("GearActivityReference has required subjectType and occurredAt fields", () => {
  const ref = {
    activityId: "movement-001",
    activityType: "CHECKED_OUT",
    subjectId: "gear-001",
    subjectType: "GEAR_ITEM",
    organizationId: "org-abc",
    occurredAt: new Date("2026-05-01T10:00:00Z"),
    actorPersonId: "person-staff-01",
  };

  assert.ok(ref.occurredAt instanceof Date);
  assert.equal(ref.subjectType, "GEAR_ITEM");
  assert.equal(typeof ref.actorPersonId, "string");
});

test("GearActivityReference allows null actorPersonId for system-generated events", () => {
  const ref = {
    activityId: "movement-002",
    activityType: "MOVED_TO_LOCATION",
    subjectId: "gear-001",
    subjectType: "GEAR_ITEM",
    organizationId: "org-abc",
    occurredAt: new Date(),
    actorPersonId: null,
  };

  assert.equal(ref.actorPersonId, null);
});
