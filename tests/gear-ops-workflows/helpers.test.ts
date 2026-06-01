import assert from "node:assert/strict";
import test from "node:test";
import {
  GearConditionStatus,
  GearInventoryType,
  GearItemInspectionResult,
  GearItemLifecycleStatus,
  GearKitInspectionStatus,
  GearMaintenanceDueStatus,
} from "@prisma/client";

import {
  buildGearWorkflowTags,
  deriveGearItemAvailabilityUpdate,
  deriveGearItemTaskSuggestions,
  deriveGearKitAvailabilityUpdate,
  deriveGearKitTaskSuggestions,
  gearWorkflowDashboardTag,
  gearWorkflowEventTag,
  gearWorkflowTemplateTag,
  parseGearWorkflowEventTag,
  parseGearWorkflowTemplateTag,
} from "@/lib/gear-ops-workflows";

test("inspection failure and maintenance signals produce maintenance workflow suggestion", () => {
  const suggestions = deriveGearItemTaskSuggestions({
    inventoryType: GearInventoryType.DURABLE,
    lifecycleStatus: GearItemLifecycleStatus.ACTIVE,
    readinessState: "MAINTENANCE_REQUIRED",
    conditionStatus: null,
    quantityOnHand: 1,
    quantityMin: null,
    lastInspectionResult: GearItemInspectionResult.MAINTENANCE_NEEDED,
    inspectionDueStatus: "CURRENT",
    maintenanceDueStatus: GearMaintenanceDueStatus.OVERDUE,
  });

  assert.deepEqual(
    suggestions.map((entry) => [entry.templateKey, entry.eventKind]),
    [["MAINTENANCE_REQUEST", "MAINTENANCE_REQUIRED"]],
  );
});

test("lost and damaged signals produce distinct workflow suggestions", () => {
  const suggestions = deriveGearItemTaskSuggestions({
    inventoryType: GearInventoryType.DURABLE,
    lifecycleStatus: GearItemLifecycleStatus.LOST,
    readinessState: "NOT_READY",
    conditionStatus: GearConditionStatus.DAMAGED,
    quantityOnHand: 1,
    quantityMin: null,
    lastInspectionResult: GearItemInspectionResult.OUT_OF_SERVICE,
    inspectionDueStatus: "CURRENT",
    maintenanceDueStatus: GearMaintenanceDueStatus.NOT_SCHEDULED,
  });

  assert.equal(suggestions.some((entry) => entry.templateKey === "MISSING_EQUIPMENT_INVESTIGATION"), true);
  assert.equal(suggestions.some((entry) => entry.templateKey === "DAMAGE_REVIEW"), true);
  assert.equal(suggestions.some((entry) => entry.eventKind === "OUT_OF_SERVICE_CONDITION"), true);
});

test("kit suggestions include missing item and inspection follow-up", () => {
  const suggestions = deriveGearKitTaskSuggestions({
    missingRequiredCount: 2,
    outOfServiceCount: 0,
    lastInspectionStatus: GearKitInspectionStatus.FAILED,
  });

  assert.deepEqual(
    suggestions.map((entry) => entry.templateKey),
    ["MISSING_EQUIPMENT_INVESTIGATION", "CONDITION_INSPECTION"],
  );
});

test("workflow tags round-trip template, event, and dashboard metadata", () => {
  const tags = buildGearWorkflowTags({
    templateKey: "MAINTENANCE_REQUEST",
    eventKind: "MAINTENANCE_REQUIRED",
    subjectType: "GEAR_ITEM",
  });

  assert.equal(tags.includes(gearWorkflowTemplateTag("MAINTENANCE_REQUEST")), true);
  assert.equal(tags.includes(gearWorkflowEventTag("MAINTENANCE_REQUIRED")), true);
  assert.equal(tags.includes(gearWorkflowDashboardTag("maintenance")), true);
  assert.equal(parseGearWorkflowTemplateTag(tags), "MAINTENANCE_REQUEST");
  assert.equal(parseGearWorkflowEventTag(tags), "MAINTENANCE_REQUIRED");
});

test("availability updates keep blocking workflows unavailable until explicitly returned", () => {
  assert.deepEqual(
    deriveGearItemAvailabilityUpdate({
      templateKey: "DAMAGE_REVIEW",
      eventKind: "DAMAGED_INVENTORY",
      currentLifecycleStatus: GearItemLifecycleStatus.ACTIVE,
      currentReadinessState: "READY",
    }),
    {
      lifecycleStatus: GearItemLifecycleStatus.QUARANTINED,
      readinessState: "NOT_READY",
    },
  );

  assert.deepEqual(
    deriveGearKitAvailabilityUpdate({
      templateKey: "MISSING_EQUIPMENT_INVESTIGATION",
      currentReadinessLabel: "READY",
      currentCustodyStatus: "AVAILABLE",
    }),
    {
      readinessLabel: "MISSING_COMPONENTS",
      custodyStatus: "IN_INSPECTION",
    },
  );
});
