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
