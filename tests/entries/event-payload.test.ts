import { strict as assert } from "node:assert";
import test from "node:test";

import {
  DEFAULT_EVENT_TIMEZONE,
  createEmptyEventEntryPayload,
  parseEventEntryPayload,
  serializeEventEntryPayload,
} from "../../lib/entries/event-payload";

test("parseEventEntryPayload returns defaults for malformed JSON", () => {
  const payload = parseEventEntryPayload("{bad-json");

  assert.deepEqual(payload, createEmptyEventEntryPayload());
});

test("parseEventEntryPayload normalizes supported scope and recurrence fields", () => {
  const payload = parseEventEntryPayload(
    JSON.stringify({
      eventType: "meeting",
      startDateTimeLocal: "2026-06-10T18:30",
      endDateTimeLocal: "2026-06-10T19:30",
      timezone: "America/New_York",
      location: "Operations Center",
      calendarScope: "program",
      programId: "prog-1",
      teamId: "team-1",
      recurrence: {
        frequency: "weekly",
        interval: "2",
        customRule: "Every other week",
        endCondition: "after_occurrences",
        endDate: "2026-09-01",
        occurrenceCount: "8",
      },
    }),
  );

  assert.equal(payload.eventType, "MEETING");
  assert.equal(payload.startDateTimeLocal, "2026-06-10T18:30");
  assert.equal(payload.endDateTimeLocal, "2026-06-10T19:30");
  assert.equal(payload.timezone, "America/New_York");
  assert.equal(payload.calendarScope, "PROGRAM");
  assert.equal(payload.programId, "prog-1");
  assert.equal(payload.teamId, "team-1");
  assert.equal(payload.recurrence.frequency, "WEEKLY");
  assert.equal(payload.recurrence.interval, 2);
  assert.equal(payload.recurrence.endCondition, "AFTER_OCCURRENCES");
  assert.equal(payload.recurrence.endDate, "2026-09-01");
  assert.equal(payload.recurrence.occurrenceCount, 8);
});

test("parseEventEntryPayload falls back to default timezone and normalizes recurrence end fields", () => {
  const payload = parseEventEntryPayload(
    JSON.stringify({
      timezone: "not-a-timezone",
      recurrence: {
        endCondition: "never",
        endDate: "2026-09-01",
        occurrenceCount: "8",
      },
    }),
  );

  assert.equal(payload.timezone, DEFAULT_EVENT_TIMEZONE);
  assert.equal(payload.recurrence.endCondition, "NEVER");
  assert.equal(payload.recurrence.endDate, null);
  assert.equal(payload.recurrence.occurrenceCount, null);
});

test("serializeEventEntryPayload emits stable shape", () => {
  const payload = createEmptyEventEntryPayload();
  payload.eventType = "TRAINING";
  payload.calendarScope = "TEAM";
  payload.teamId = "team-7";
  payload.recurrence.frequency = "MONTHLY";
  payload.recurrence.endCondition = "ON_DATE";
  payload.recurrence.endDate = "2026-12-31";

  const serialized = serializeEventEntryPayload(payload);
  const parsed = JSON.parse(serialized) as ReturnType<typeof createEmptyEventEntryPayload>;

  assert.equal(parsed.eventType, "TRAINING");
  assert.equal(parsed.calendarScope, "TEAM");
  assert.equal(parsed.teamId, "team-7");
  assert.equal(parsed.recurrence.frequency, "MONTHLY");
  assert.equal(parsed.recurrence.endCondition, "ON_DATE");
  assert.equal(parsed.recurrence.endDate, "2026-12-31");
});
