import { strict as assert } from "node:assert";
import test from "node:test";

import {
  inferDiscrepancyTypeFromVerification,
  INVENTORY_AUDIT_ACTIVITY_ACTIONS,
  labelForInventoryAuditScope,
  labelForInventoryAuditSessionStatus,
  labelForInventoryAuditType,
  labelForInventoryDiscrepancyStatus,
  labelForInventoryDiscrepancyType,
  labelForInventoryVerificationStatus,
} from "../../lib/inventory-audit/types";

test("inventory audit label helpers return readable values", () => {
  assert.equal(labelForInventoryAuditType("SCHEDULED"), "Scheduled");
  assert.equal(labelForInventoryAuditType("READINESS_INSPECTION"), "Readiness inspection");
  assert.equal(labelForInventoryAuditScope("LOCATION"), "Location");
  assert.equal(labelForInventoryAuditSessionStatus("IN_PROGRESS"), "In progress");
  assert.equal(labelForInventoryVerificationStatus("VERIFIED_DISCREPANCY"), "Verified discrepancy");
  assert.equal(labelForInventoryDiscrepancyType("WRONG_LOCATION"), "Wrong location");
  assert.equal(labelForInventoryDiscrepancyStatus("RESOLVED"), "Resolved");
});

test("inferDiscrepancyTypeFromVerification maps NOT_FOUND to missing inventory", () => {
  assert.equal(
    inferDiscrepancyTypeFromVerification({
      verificationStatus: "NOT_FOUND",
    }),
    "MISSING_INVENTORY",
  );
});

test("inferDiscrepancyTypeFromVerification detects location mismatch", () => {
  assert.equal(
    inferDiscrepancyTypeFromVerification({
      verificationStatus: "VERIFIED_DISCREPANCY",
      expectedLocationId: "loc-1",
      observedLocationId: "loc-2",
    }),
    "WRONG_LOCATION",
  );
});

test("inferDiscrepancyTypeFromVerification detects quantity mismatch", () => {
  assert.equal(
    inferDiscrepancyTypeFromVerification({
      verificationStatus: "VERIFIED_DISCREPANCY",
      expectedQuantity: 10,
      observedQuantity: 8,
    }),
    "QUANTITY_MISMATCH",
  );
});

test("inferDiscrepancyTypeFromVerification detects readiness failures", () => {
  assert.equal(
    inferDiscrepancyTypeFromVerification({
      verificationStatus: "VERIFIED_DISCREPANCY",
      expectedReadinessState: "READY",
      observedReadinessState: "NOT_READY",
    }),
    "READINESS_FAILURE",
  );
});

test("INVENTORY_AUDIT_ACTIVITY_ACTIONS exposes expected constants", () => {
  assert.equal(INVENTORY_AUDIT_ACTIVITY_ACTIONS.AUDIT_CREATED, "inventory.audit.created");
  assert.equal(INVENTORY_AUDIT_ACTIVITY_ACTIONS.SESSION_STARTED, "inventory.audit.session.started");
  assert.equal(INVENTORY_AUDIT_ACTIVITY_ACTIONS.VERIFICATION_RECORDED, "inventory.audit.verification.recorded");
  assert.equal(INVENTORY_AUDIT_ACTIVITY_ACTIONS.DISCREPANCY_OPENED, "inventory.audit.discrepancy.opened");
  assert.equal(INVENTORY_AUDIT_ACTIVITY_ACTIONS.DISCREPANCY_RESOLVED, "inventory.audit.discrepancy.resolved");
});
