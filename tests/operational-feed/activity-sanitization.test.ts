import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryType } from "@prisma/client";

import { sanitizeActivityEntryTitle } from "../../lib/operational-feed/queries";

test("sanitizeActivityEntryTitle preserves non-journal titles", () => {
  assert.equal(sanitizeActivityEntryTitle("entry.created", EntryType.TASK, "Prepare lineup"), "Prepare lineup");
});

test("sanitizeActivityEntryTitle strips journal titles in feed activity", () => {
  assert.equal(
    sanitizeActivityEntryTitle("journal.submitted", EntryType.JOURNAL, "Private confidence reflection"),
    "Journal submitted",
  );
  assert.equal(sanitizeActivityEntryTitle("entry.updated", EntryType.JOURNAL, "Very private draft"), "Journal entry");
  assert.equal(sanitizeActivityEntryTitle("unexpected.action", EntryType.JOURNAL, "Hidden"), "Journal entry");
});

test("sanitizeActivityEntryTitle maps prompt actions to specific safe labels for journal entries", () => {
  assert.equal(
    sanitizeActivityEntryTitle("journal.prompt_assigned", EntryType.JOURNAL, "Athlete prompt title"),
    "Journal prompt assigned",
  );
  assert.equal(
    sanitizeActivityEntryTitle("journal.prompt_response_submitted", EntryType.JOURNAL, "Sensitive response title"),
    "Journal prompt completed",
  );
  assert.equal(
    sanitizeActivityEntryTitle("journal.prompt_assignment_cancelled", EntryType.JOURNAL, "Private content"),
    "Prompt assignment cancelled",
  );
});

test("sanitizeActivityEntryTitle sanitizes HABIT entries as a defensive guard", () => {
  assert.equal(
    sanitizeActivityEntryTitle("habit.checked_in", EntryType.HABIT, "Morning stretching routine"),
    "Habit check-in recorded",
  );
  assert.equal(
    sanitizeActivityEntryTitle("habit.assigned", EntryType.HABIT, "Private athlete habit title"),
    "Habit assigned",
  );
  assert.equal(
    sanitizeActivityEntryTitle("habit.archived", EntryType.HABIT, "Athlete personal habit"),
    "Habit archived",
  );
  assert.equal(
    sanitizeActivityEntryTitle("unknown.habit.action", EntryType.HABIT, "Private title"),
    "Habit event",
  );
});
