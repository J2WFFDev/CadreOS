import { strict as assert } from "node:assert";
import test from "node:test";

import { ENTRY_ACTIVITY_ACTIONS } from "../../lib/operational-entry";

test("entry activity actions include Arc 22E notification-ready concepts", () => {
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_CREATED, "entry.created");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_UPDATED, "entry.updated");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_LINKED, "entry.linked");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_UNLINKED, "entry.unlinked");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED, "entry.assignment_added");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_STATUS_CHANGED, "entry.status_changed");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.FOLLOW_UP_CREATED, "entry.follow_up_created");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.FOLLOW_UP_ASSIGNED, "entry.follow_up_assigned");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.FOLLOW_UP_COMPLETED, "entry.follow_up_completed");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_COMPLETED, "entry.completed");
  assert.equal(ENTRY_ACTIVITY_ACTIONS.ENTRY_ARCHIVED, "entry.archived");
});

