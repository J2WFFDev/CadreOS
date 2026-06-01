import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveReservationWorkflowStatus,
  deriveReturnWorkflowStatus,
  isInspectionIssueCondition,
} from "@/lib/gear-reservation-foundation";

test("deriveReservationWorkflowStatus maps pending review to pending approval", () => {
  assert.equal(deriveReservationWorkflowStatus("PENDING_REVIEW"), "PENDING_APPROVAL");
});

test("deriveReservationWorkflowStatus maps active to approved", () => {
  assert.equal(deriveReservationWorkflowStatus("ACTIVE"), "APPROVED");
});

test("deriveReservationWorkflowStatus maps canceled to cancelled", () => {
  assert.equal(deriveReservationWorkflowStatus("CANCELED"), "CANCELLED");
});

test("isInspectionIssueCondition detects damaged and poor return conditions", () => {
  assert.equal(isInspectionIssueCondition("DAMAGED"), true);
  assert.equal(isInspectionIssueCondition("POOR"), true);
  assert.equal(isInspectionIssueCondition("GOOD"), false);
});

test("deriveReturnWorkflowStatus marks inspection needed for issue returns", () => {
  assert.equal(deriveReturnWorkflowStatus({ conditionOnReturn: "DAMAGED" }), "INSPECTION_NEEDED");
  assert.equal(deriveReturnWorkflowStatus({ conditionOnReturn: "GOOD" }), "RETURNED");
});
