import { strict as assert } from "node:assert";
import test from "node:test";

import {
  deriveEventGearAssignmentStatus,
  deriveEventGearAvailability,
  summarizeEventGearPlan,
  summarizeEventGearRequirement,
} from "../../lib/event-gear";

test("deriveEventGearAvailability flags blocking custody as unavailable", () => {
  const status = deriveEventGearAvailability({
    stagedAt: null,
    recoveredAt: null,
    activeEventCheckout: null,
    blockingCheckout: { status: "OPEN", returnedAt: null },
    gearItem: {
      lifecycleStatus: "ACTIVE",
      readinessState: "READY",
      conditionStatus: "GOOD",
      quantityOnHand: 4,
      quantityMin: 1,
    },
  });

  assert.equal(status, "UNAVAILABLE");
});

test("deriveEventGearAvailability separates out-of-service and maintenance-needed states", () => {
  assert.equal(
    deriveEventGearAvailability({
      stagedAt: null,
      recoveredAt: null,
      activeEventCheckout: null,
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "QUARANTINED",
        readinessState: "READY",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "OUT_OF_SERVICE",
  );

  assert.equal(
    deriveEventGearAvailability({
      stagedAt: null,
      recoveredAt: null,
      activeEventCheckout: null,
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "ACTIVE",
        readinessState: "MAINTENANCE_REQUIRED",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "MAINTENANCE_NEEDED",
  );
});

test("deriveEventGearAssignmentStatus follows staging, deployment, return, and recovery flow", () => {
  assert.equal(
    deriveEventGearAssignmentStatus({
      stagedAt: null,
      recoveredAt: null,
      activeEventCheckout: null,
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "ACTIVE",
        readinessState: "READY",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "ASSIGNED",
  );

  assert.equal(
    deriveEventGearAssignmentStatus({
      stagedAt: new Date("2026-05-26T10:00:00Z"),
      recoveredAt: null,
      activeEventCheckout: null,
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "ACTIVE",
        readinessState: "READY",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "STAGED",
  );

  assert.equal(
    deriveEventGearAssignmentStatus({
      stagedAt: new Date("2026-05-26T10:00:00Z"),
      recoveredAt: null,
      activeEventCheckout: { status: "OPEN", returnedAt: null },
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "ACTIVE",
        readinessState: "READY",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "DEPLOYED",
  );

  assert.equal(
    deriveEventGearAssignmentStatus({
      stagedAt: new Date("2026-05-26T10:00:00Z"),
      recoveredAt: null,
      activeEventCheckout: { status: "RETURNED", returnedAt: new Date("2026-05-27T01:00:00Z") },
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "ACTIVE",
        readinessState: "READY",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "RETURNED",
  );

  assert.equal(
    deriveEventGearAssignmentStatus({
      stagedAt: new Date("2026-05-26T10:00:00Z"),
      recoveredAt: new Date("2026-05-27T02:00:00Z"),
      activeEventCheckout: { status: "RETURNED", returnedAt: new Date("2026-05-27T01:00:00Z") },
      blockingCheckout: null,
      gearItem: {
        lifecycleStatus: "ACTIVE",
        readinessState: "READY",
        conditionStatus: "GOOD",
        quantityOnHand: 1,
        quantityMin: null,
      },
    }),
    "RECOVERED",
  );
});

test("summaries surface missing, limited-use, and readiness concerns", () => {
  const requirementSummary = summarizeEventGearRequirement({
    requirementType: "REQUIRED",
    quantityNeeded: 2,
    assignments: [
      {
        stagedAt: new Date("2026-05-26T10:00:00Z"),
        recoveredAt: null,
        activeEventCheckout: null,
        blockingCheckout: null,
        gearItem: {
          lifecycleStatus: "ACTIVE",
          readinessState: "READY",
          conditionStatus: "GOOD",
          quantityOnHand: 3,
          quantityMin: 1,
        },
      },
    ],
  });

  assert.equal(requirementSummary.assignedCount, 1);
  assert.equal(requirementSummary.gapCount, 1);
  assert.equal(requirementSummary.readyCount, 1);

  const planSummary = summarizeEventGearPlan({
    requirements: [
      {
        requirementType: "REQUIRED",
        quantityNeeded: 2,
        assignments: [
          {
            stagedAt: new Date("2026-05-26T10:00:00Z"),
            recoveredAt: null,
            activeEventCheckout: null,
            blockingCheckout: null,
            gearItem: {
              lifecycleStatus: "ACTIVE",
              readinessState: "READY",
              conditionStatus: "GOOD",
              quantityOnHand: 3,
              quantityMin: 1,
            },
          },
        ],
      },
      {
        requirementType: "SUPPORT",
        quantityNeeded: 1,
        assignments: [
          {
            stagedAt: null,
            recoveredAt: null,
            activeEventCheckout: null,
            blockingCheckout: null,
            gearItem: {
              lifecycleStatus: "ACTIVE",
              readinessState: "NEEDS_INSPECTION",
              conditionStatus: "FAIR",
              quantityOnHand: 1,
              quantityMin: 1,
            },
          },
        ],
      },
    ],
  });

  assert.equal(planSummary.requirementCount, 2);
  assert.equal(planSummary.requiredRequirementCount, 1);
  assert.equal(planSummary.supportRequirementCount, 1);
  assert.equal(planSummary.assignmentCount, 2);
  assert.equal(planSummary.stagedCount, 1);
  assert.equal(planSummary.gapCount, 1);
  assert.equal(planSummary.readyCount, 1);
  assert.equal(planSummary.limitedUseCount, 1);
  assert.equal(planSummary.concernCount, 1);
});
