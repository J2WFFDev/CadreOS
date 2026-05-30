import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryPriority, EntryType } from "@prisma/client";

import { mapEntryPriorityToInboxPriority, shouldRouteEntryToInbox } from "../../lib/entries/inbox";

test("shouldRouteEntryToInbox returns true for low-context no-due captures", () => {
  const shouldRoute = shouldRouteEntryToInbox({
    entryType: EntryType.NOTE,
    contextTargetId: null,
  });

  assert.equal(shouldRoute, true);
});

test("shouldRouteEntryToInbox keeps dated tasks in inbox unless context routing exists", () => {
  assert.equal(
    shouldRouteEntryToInbox({
      entryType: EntryType.TASK,
      contextTargetId: null,
    }),
    true,
  );

  assert.equal(
    shouldRouteEntryToInbox({
      entryType: EntryType.NOTE,
      contextTargetId: "team_123",
    }),
    false,
  );
});

test("shouldRouteEntryToInbox excludes event entries from inbox routing", () => {
  assert.equal(
    shouldRouteEntryToInbox({
      entryType: EntryType.EVENT,
      contextTargetId: null,
    }),
    false,
  );
});

test("mapEntryPriorityToInboxPriority maps enum priority to queue severity", () => {
  assert.equal(mapEntryPriorityToInboxPriority(EntryPriority.LOW), 10);
  assert.equal(mapEntryPriorityToInboxPriority(EntryPriority.MEDIUM), 20);
  assert.equal(mapEntryPriorityToInboxPriority(EntryPriority.HIGH), 30);
  assert.equal(mapEntryPriorityToInboxPriority(EntryPriority.URGENT), 40);
});
