import { strict as assert } from "node:assert";
import test from "node:test";

import {
  defaultRelationshipTypeForEntryObjectTarget,
  isEntryObjectLinkTargetType,
  labelForEntryObjectLinkTargetType,
} from "../../lib/entries/object-links";

test("labelForEntryObjectLinkTargetType returns readable labels", () => {
  assert.equal(labelForEntryObjectLinkTargetType("PERSON"), "Person");
  assert.equal(labelForEntryObjectLinkTargetType("RESOURCE_BOOKING"), "Reservation");
  assert.equal(labelForEntryObjectLinkTargetType("FOLLOW_UP_TASK"), "Task");
});

test("defaultRelationshipTypeForEntryObjectTarget applies event and reservation defaults", () => {
  assert.equal(defaultRelationshipTypeForEntryObjectTarget("EVENT"), "OBSERVED_DURING");
  assert.equal(defaultRelationshipTypeForEntryObjectTarget("RESOURCE_BOOKING"), "READINESS_FOR");
  assert.equal(defaultRelationshipTypeForEntryObjectTarget("TEAM"), "RELATED_TO");
});

test("isEntryObjectLinkTargetType validates enum inputs", () => {
  assert.equal(isEntryObjectLinkTargetType("PERSON"), true);
  assert.equal(isEntryObjectLinkTargetType("NOT_A_TARGET"), false);
});
