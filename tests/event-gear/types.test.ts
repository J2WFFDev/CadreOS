import { strict as assert } from "node:assert";
import test from "node:test";

import {
  deriveEventGearAssignmentStatus,
  deriveEventGearAvailability,
  formatEventGearEnum,
  getEventGearAvailabilityBadgeClass,
  getEventGearPlanStatusBadgeClass,
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


// ---------------------------------------------------------------------------
// formatEventGearEnum
// ---------------------------------------------------------------------------

test("formatEventGearEnum converts SNAKE_CASE to Title Case", () => {
  assert.equal(formatEventGearEnum("DRAFT"), "Draft");
  assert.equal(formatEventGearEnum("DEPLOYED"), "Deployed");
  assert.equal(formatEventGearEnum("FULLY_STAGED"), "Fully Staged");
  assert.equal(formatEventGearEnum("PARTIALLY_STAGED"), "Partially Staged");
});

// ---------------------------------------------------------------------------
// getEventGearPlanStatusBadgeClass
// ---------------------------------------------------------------------------

test("getEventGearPlanStatusBadgeClass COMPLETED maps to emerald/green tones", () => {
  const cls = getEventGearPlanStatusBadgeClass("COMPLETED");
  assert.ok(cls.includes("emerald") || cls.includes("green"), `Expected emerald/green in "${cls}"`);
});

test("getEventGearPlanStatusBadgeClass DEPLOYED maps to blue tones", () => {
  const cls = getEventGearPlanStatusBadgeClass("DEPLOYED");
  assert.ok(cls.includes("blue"), `Expected blue in "${cls}"`);
});

test("getEventGearPlanStatusBadgeClass STAGED maps to violet tones", () => {
  const cls = getEventGearPlanStatusBadgeClass("STAGED");
  assert.ok(cls.includes("violet"), `Expected violet in "${cls}"`);
});

test("getEventGearPlanStatusBadgeClass DRAFT maps to zinc/neutral fallback", () => {
  const cls = getEventGearPlanStatusBadgeClass("DRAFT");
  assert.ok(cls.includes("zinc") || cls.includes("slate"), `Expected neutral tone in "${cls}"`);
});

// ---------------------------------------------------------------------------
// getEventGearAvailabilityBadgeClass
// ---------------------------------------------------------------------------

test("getEventGearAvailabilityBadgeClass READY maps to emerald", () => {
  assert.ok(getEventGearAvailabilityBadgeClass("READY").includes("emerald"));
});

test("getEventGearAvailabilityBadgeClass LIMITED_USE maps to blue", () => {
  assert.ok(getEventGearAvailabilityBadgeClass("LIMITED_USE").includes("blue"));
});

test("getEventGearAvailabilityBadgeClass UNAVAILABLE maps to amber", () => {
  assert.ok(getEventGearAvailabilityBadgeClass("UNAVAILABLE").includes("amber"));
});

test("getEventGearAvailabilityBadgeClass OUT_OF_SERVICE and MAINTENANCE_NEEDED map to rose", () => {
  assert.ok(getEventGearAvailabilityBadgeClass("OUT_OF_SERVICE").includes("rose"));
  assert.ok(getEventGearAvailabilityBadgeClass("MAINTENANCE_NEEDED").includes("rose"));
});

// ---------------------------------------------------------------------------
// deriveEventGearAvailability — blockingAssignment branch
// ---------------------------------------------------------------------------

test("deriveEventGearAvailability returns UNAVAILABLE when there is a blocking assignment", () => {
  const result = deriveEventGearAvailability({
    stagedAt: null,
    recoveredAt: null,
    gearItem: {
      lifecycleStatus: "ACTIVE",
      readinessState: "READY",
      conditionStatus: "GOOD",
      quantityOnHand: 1,
      quantityMin: null,
    },
    activeEventCheckout: null,
    blockingAssignment: true,
  });
  assert.equal(result, "UNAVAILABLE");
});
