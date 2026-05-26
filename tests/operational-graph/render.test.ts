import { strict as assert } from "node:assert";
import test from "node:test";

import {
  labelForOperationalNodeType,
  labelForOperationalRelationshipType,
  mapEntryObjectLinkTargetToGraphNodeType,
} from "../../lib/operational-graph";

test("labelForOperationalRelationshipType returns readable labels", () => {
  assert.equal(labelForOperationalRelationshipType("RELATED_TO"), "Related to");
  assert.equal(labelForOperationalRelationshipType("BLOCKED_BY"), "Blocked by");
  assert.equal(labelForOperationalRelationshipType("READINESS_FOR"), "Readiness for");
});

test("labelForOperationalNodeType returns readable labels", () => {
  assert.equal(labelForOperationalNodeType("ENTRY"), "Entry");
  assert.equal(labelForOperationalNodeType("RESOURCE_BOOKING"), "Reservation");
  assert.equal(labelForOperationalNodeType("GEAR_MAINTENANCE_LOG"), "Maintenance record");
});

test("entry object-link targets map to graph node types", () => {
  assert.equal(mapEntryObjectLinkTargetToGraphNodeType("EVENT"), "EVENT");
  assert.equal(mapEntryObjectLinkTargetToGraphNodeType("RESOURCE_BOOKING"), "RESOURCE_BOOKING");
  assert.equal(mapEntryObjectLinkTargetToGraphNodeType("FOLLOW_UP_TASK"), "FOLLOW_UP_TASK");
});
