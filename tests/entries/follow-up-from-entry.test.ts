import { strict as assert } from "node:assert";
import test from "node:test";

import { deriveEntryFollowUpDraft } from "../../lib/entries/service";

test("deriveEntryFollowUpDraft defaults title and description from source entry", () => {
  const draft = deriveEntryFollowUpDraft({
    entryTitle: "Attendance concern: athlete absent",
    entryContent: "Follow up with family and training staff.",
  });

  assert.equal(draft.title, "Follow up: Attendance concern: athlete absent");
  assert.equal(draft.description, "Follow up with family and training staff.");
});

test("deriveEntryFollowUpDraft prefers provided values when present", () => {
  const draft = deriveEntryFollowUpDraft({
    entryTitle: "Source entry",
    entryContent: "Source content",
    providedTitle: "Call guardian",
    providedDescription: "Confirm availability and transportation details.",
  });

  assert.equal(draft.title, "Call guardian");
  assert.equal(draft.description, "Confirm availability and transportation details.");
});

test("deriveEntryFollowUpDraft falls back safely when source is empty", () => {
  const draft = deriveEntryFollowUpDraft({
    entryTitle: "   ",
    entryContent: null,
  });

  assert.equal(draft.title, "Entry follow-up task");
  assert.equal(draft.description, null);
});
