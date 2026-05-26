import { strict as assert } from "node:assert";
import test from "node:test";

import {
  CUSTODY_MOVEMENT_TYPES,
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ATTENTION_STATES,
  INVENTORY_LIFECYCLE_STATES,
  INVENTORY_UNAVAILABLE_STATES,
  LIFECYCLE_MOVEMENT_TYPES,
  LOCATION_MOVEMENT_TYPES,
  labelForMovementType,
  labelForOwnershipType,
  labelForReadinessState,
  lifecycleStatusForMovementType,
} from "../../lib/inventory-ops/types";

// ── Lifecycle state groupings ────────────────────────────────────────────────

test("INVENTORY_LIFECYCLE_STATES includes all expected operational states", () => {
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("ACTIVE"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("ASSIGNED"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("CHECKED_OUT"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("RESERVED"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("MAINTENANCE"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("QUARANTINED"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("RETIRED"));
  assert.ok(INVENTORY_LIFECYCLE_STATES.includes("LOST"));
});

test("INVENTORY_UNAVAILABLE_STATES does not include ACTIVE or RESERVED", () => {
  assert.ok(!INVENTORY_UNAVAILABLE_STATES.includes("ACTIVE"));
  assert.ok(!INVENTORY_UNAVAILABLE_STATES.includes("RESERVED"));
  assert.ok(INVENTORY_UNAVAILABLE_STATES.includes("ASSIGNED"));
  assert.ok(INVENTORY_UNAVAILABLE_STATES.includes("MAINTENANCE"));
  assert.ok(INVENTORY_UNAVAILABLE_STATES.includes("QUARANTINED"));
});

test("INVENTORY_ATTENTION_STATES includes critical operational states", () => {
  assert.ok(INVENTORY_ATTENTION_STATES.includes("MAINTENANCE"));
  assert.ok(INVENTORY_ATTENTION_STATES.includes("QUARANTINED"));
  assert.ok(INVENTORY_ATTENTION_STATES.includes("LOST"));
  assert.ok(!INVENTORY_ATTENTION_STATES.includes("ACTIVE"));
  assert.ok(!INVENTORY_ATTENTION_STATES.includes("ASSIGNED"));
});

// ── Movement type groupings ──────────────────────────────────────────────────

test("CUSTODY_MOVEMENT_TYPES includes checkout, assignment, and loan types", () => {
  assert.ok(CUSTODY_MOVEMENT_TYPES.includes("CHECKED_OUT"));
  assert.ok(CUSTODY_MOVEMENT_TYPES.includes("CHECKED_IN"));
  assert.ok(CUSTODY_MOVEMENT_TYPES.includes("ASSIGNED"));
  assert.ok(CUSTODY_MOVEMENT_TYPES.includes("UNASSIGNED"));
  assert.ok(CUSTODY_MOVEMENT_TYPES.includes("LOANED_OUT"));
  assert.ok(CUSTODY_MOVEMENT_TYPES.includes("LOAN_RETURNED"));
});

test("LOCATION_MOVEMENT_TYPES includes physical transfer types", () => {
  assert.ok(LOCATION_MOVEMENT_TYPES.includes("MOVED_TO_LOCATION"));
  assert.ok(LOCATION_MOVEMENT_TYPES.includes("TRANSFERRED"));
  assert.ok(LOCATION_MOVEMENT_TYPES.includes("SENT_FOR_MAINTENANCE"));
  assert.ok(LOCATION_MOVEMENT_TYPES.includes("RETURNED_FROM_MAINTENANCE"));
});

test("LIFECYCLE_MOVEMENT_TYPES includes state transition types", () => {
  assert.ok(LIFECYCLE_MOVEMENT_TYPES.includes("RESERVED"));
  assert.ok(LIFECYCLE_MOVEMENT_TYPES.includes("RESERVATION_RELEASED"));
  assert.ok(LIFECYCLE_MOVEMENT_TYPES.includes("QUARANTINED"));
  assert.ok(LIFECYCLE_MOVEMENT_TYPES.includes("QUARANTINE_RELEASED"));
  assert.ok(LIFECYCLE_MOVEMENT_TYPES.includes("LOST"));
  assert.ok(LIFECYCLE_MOVEMENT_TYPES.includes("RETIRED"));
});

// ── lifecycleStatusForMovementType ───────────────────────────────────────────

test("lifecycleStatusForMovementType maps CHECKED_OUT to CHECKED_OUT", () => {
  assert.equal(lifecycleStatusForMovementType("CHECKED_OUT"), "CHECKED_OUT");
});

test("lifecycleStatusForMovementType maps CHECKED_IN to ACTIVE", () => {
  assert.equal(lifecycleStatusForMovementType("CHECKED_IN"), "ACTIVE");
});

test("lifecycleStatusForMovementType maps ASSIGNED to ASSIGNED", () => {
  assert.equal(lifecycleStatusForMovementType("ASSIGNED"), "ASSIGNED");
});

test("lifecycleStatusForMovementType maps UNASSIGNED to ACTIVE", () => {
  assert.equal(lifecycleStatusForMovementType("UNASSIGNED"), "ACTIVE");
});

test("lifecycleStatusForMovementType maps SENT_FOR_MAINTENANCE to MAINTENANCE", () => {
  assert.equal(lifecycleStatusForMovementType("SENT_FOR_MAINTENANCE"), "MAINTENANCE");
});

test("lifecycleStatusForMovementType maps RETURNED_FROM_MAINTENANCE to ACTIVE", () => {
  assert.equal(lifecycleStatusForMovementType("RETURNED_FROM_MAINTENANCE"), "ACTIVE");
});

test("lifecycleStatusForMovementType maps QUARANTINED to QUARANTINED", () => {
  assert.equal(lifecycleStatusForMovementType("QUARANTINED"), "QUARANTINED");
});

test("lifecycleStatusForMovementType maps QUARANTINE_RELEASED to ACTIVE", () => {
  assert.equal(lifecycleStatusForMovementType("QUARANTINE_RELEASED"), "ACTIVE");
});

test("lifecycleStatusForMovementType maps LOST to LOST", () => {
  assert.equal(lifecycleStatusForMovementType("LOST"), "LOST");
});

test("lifecycleStatusForMovementType maps RETIRED to RETIRED", () => {
  assert.equal(lifecycleStatusForMovementType("RETIRED"), "RETIRED");
});

test("lifecycleStatusForMovementType maps RESERVED to RESERVED", () => {
  assert.equal(lifecycleStatusForMovementType("RESERVED"), "RESERVED");
});

test("lifecycleStatusForMovementType returns null for MOVED_TO_LOCATION (no lifecycle change)", () => {
  assert.equal(lifecycleStatusForMovementType("MOVED_TO_LOCATION"), null);
});

test("lifecycleStatusForMovementType returns null for RECEIVED (no lifecycle change implied)", () => {
  assert.equal(lifecycleStatusForMovementType("RECEIVED"), null);
});

// ── Label helpers ────────────────────────────────────────────────────────────

test("labelForMovementType returns human-readable strings", () => {
  assert.equal(labelForMovementType("CHECKED_OUT"), "Checked out");
  assert.equal(labelForMovementType("MOVED_TO_LOCATION"), "Moved to location");
  assert.equal(labelForMovementType("SENT_FOR_MAINTENANCE"), "Sent for maintenance");
  assert.equal(labelForMovementType("QUARANTINED"), "Quarantined");
  assert.equal(labelForMovementType("LOAN_RETURNED"), "Loan returned");
});

test("labelForReadinessState returns human-readable strings", () => {
  assert.equal(labelForReadinessState("READY"), "Ready");
  assert.equal(labelForReadinessState("NEEDS_INSPECTION"), "Needs inspection");
  assert.equal(labelForReadinessState("MAINTENANCE_REQUIRED"), "Maintenance required");
  assert.equal(labelForReadinessState("NOT_READY"), "Not ready");
  assert.equal(labelForReadinessState("DECOMMISSIONED"), "Decommissioned");
});

test("labelForOwnershipType returns human-readable strings", () => {
  assert.equal(labelForOwnershipType("ORGANIZATION_OWNED"), "Organization owned");
  assert.equal(labelForOwnershipType("PERSONALLY_OWNED"), "Personally owned");
  assert.equal(labelForOwnershipType("LOANED_IN"), "Loaned in");
  assert.equal(labelForOwnershipType("LOANED_OUT"), "Loaned out");
  assert.equal(labelForOwnershipType("DONATED"), "Donated");
});

// ── Activity action constants ─────────────────────────────────────────────────

test("INVENTORY_ACTIVITY_ACTIONS contains all expected action strings", () => {
  assert.equal(INVENTORY_ACTIVITY_ACTIONS.MOVEMENT_RECORDED, "inventory.movement.recorded");
  assert.equal(INVENTORY_ACTIVITY_ACTIONS.LOCATION_CREATED, "inventory.location.created");
  assert.equal(INVENTORY_ACTIVITY_ACTIONS.KIT_CREATED, "inventory.kit.created");
  assert.equal(INVENTORY_ACTIVITY_ACTIONS.KIT_ITEM_ADDED, "inventory.kit.item_added");
  assert.equal(INVENTORY_ACTIVITY_ACTIONS.KIT_ITEM_REMOVED, "inventory.kit.item_removed");
  assert.equal(INVENTORY_ACTIVITY_ACTIONS.READINESS_STATE_CHANGED, "inventory.readiness_state.changed");
});

// ── State machine consistency ────────────────────────────────────────────────

test("all states that go through CHECKED_OUT also return via CHECKED_IN → ACTIVE", () => {
  assert.equal(lifecycleStatusForMovementType("CHECKED_OUT"), "CHECKED_OUT");
  assert.equal(lifecycleStatusForMovementType("CHECKED_IN"), "ACTIVE");
});

test("all loan movements have symmetric return transitions", () => {
  assert.equal(lifecycleStatusForMovementType("LOANED_OUT"), "ASSIGNED");
  assert.equal(lifecycleStatusForMovementType("LOAN_RETURNED"), "ACTIVE");
});

test("quarantine has a symmetric release transition", () => {
  assert.equal(lifecycleStatusForMovementType("QUARANTINED"), "QUARANTINED");
  assert.equal(lifecycleStatusForMovementType("QUARANTINE_RELEASED"), "ACTIVE");
});

test("reservation has a symmetric release transition", () => {
  assert.equal(lifecycleStatusForMovementType("RESERVED"), "RESERVED");
  assert.equal(lifecycleStatusForMovementType("RESERVATION_RELEASED"), "ACTIVE");
});
