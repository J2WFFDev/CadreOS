import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildDashboardConcernSummary,
  deriveAvailabilitySignal,
  deriveItemConcernLevel,
  getAssignmentBadgeClass,
  getAssignmentLabel,
  getAssignmentTone,
  getAvailabilitySignalChipClass,
  getAvailabilitySignalLabel,
  getCheckoutBadgeClass,
  getCheckoutLabel,
  getCheckoutTone,
  getConcernLevelChipClass,
  getConditionBadgeClass,
  getConditionLabel,
  getConditionTone,
  getInventoryTypeBadgeClass,
  getInventoryTypeLabel,
  getLifecycleBadgeClass,
  getLifecycleLabel,
  getLifecycleTone,
  getReadinessBadgeClass,
  getReadinessLabel,
  getReadinessTone,
  toneToBoxClass,
  toneToChipClass,
  type GearAvailabilitySignal,
  type GearConcernLevel,
  type LifecycleTone,
} from "../../lib/gear-ops-ui";

// ---------------------------------------------------------------------------
// Lifecycle tone + badge class
// ---------------------------------------------------------------------------

test("ACTIVE lifecycle maps to success tone", () => {
  assert.equal(getLifecycleTone("ACTIVE"), "success");
});

test("MAINTENANCE lifecycle maps to warning tone", () => {
  assert.equal(getLifecycleTone("MAINTENANCE"), "warning");
  assert.equal(getLifecycleTone("QUARANTINED"), "warning");
});

test("RETIRED / LOST lifecycle maps to danger tone", () => {
  assert.equal(getLifecycleTone("RETIRED"), "danger");
  assert.equal(getLifecycleTone("LOST"), "danger");
});

test("ASSIGNED / CHECKED_OUT / RESERVED lifecycle maps to info tone", () => {
  assert.equal(getLifecycleTone("ASSIGNED"), "info");
  assert.equal(getLifecycleTone("CHECKED_OUT"), "info");
  assert.equal(getLifecycleTone("RESERVED"), "info");
});

test("getLifecycleBadgeClass returns a non-empty Tailwind class string", () => {
  const cls = getLifecycleBadgeClass("ACTIVE");
  assert.ok(typeof cls === "string" && cls.length > 0);
});

// ---------------------------------------------------------------------------
// Condition tone + badge class
// ---------------------------------------------------------------------------

test("GOOD condition maps to success tone", () => {
  assert.equal(getConditionTone("GOOD"), "success");
});

test("WORN condition maps to danger tone (falls to default)", () => {
  // WORN is not a recognized GearConditionStatus case → default → "danger"
  assert.equal(getConditionTone("WORN" as Parameters<typeof getConditionTone>[0]), "danger");
});

test("DAMAGED condition maps to warning tone", () => {
  assert.equal(getConditionTone("DAMAGED"), "warning");
  assert.equal(getConditionTone("POOR"), "warning");
});

test("null condition maps to neutral tone", () => {
  assert.equal(getConditionTone(null), "neutral");
});

test("getConditionBadgeClass returns a non-empty string for GOOD", () => {
  const cls = getConditionBadgeClass("GOOD");
  assert.ok(typeof cls === "string" && cls.length > 0);
});

// ---------------------------------------------------------------------------
// Readiness tone + badge class
// ---------------------------------------------------------------------------

test("READY readiness maps to success tone", () => {
  assert.equal(getReadinessTone("READY"), "success");
});

test("NEEDS_INSPECTION readiness maps to info tone", () => {
  assert.equal(getReadinessTone("NEEDS_INSPECTION"), "info");
});

test("MAINTENANCE_REQUIRED / NOT_READY readiness maps to warning tone", () => {
  assert.equal(getReadinessTone("MAINTENANCE_REQUIRED"), "warning");
  assert.equal(getReadinessTone("NOT_READY"), "warning");
});

test("null readiness maps to neutral tone", () => {
  assert.equal(getReadinessTone(null), "neutral");
});

test("getReadinessBadgeClass returns a non-empty string", () => {
  const cls = getReadinessBadgeClass("READY");
  assert.ok(typeof cls === "string" && cls.length > 0);
});

// ---------------------------------------------------------------------------
// Checkout tone + badge class
// ---------------------------------------------------------------------------

test("OPEN checkout maps to info tone", () => {
  assert.equal(getCheckoutTone("OPEN"), "info");
});

test("OVERDUE checkout maps to warning tone", () => {
  assert.equal(getCheckoutTone("OVERDUE"), "warning");
});

test("RETURNED checkout maps to success tone", () => {
  assert.equal(getCheckoutTone("RETURNED"), "success");
});

test("getCheckoutBadgeClass returns a non-empty string", () => {
  const cls = getCheckoutBadgeClass("OPEN");
  assert.ok(typeof cls === "string" && cls.length > 0);
});

// ---------------------------------------------------------------------------
// Assignment tone + badge class
// ---------------------------------------------------------------------------

test("ACTIVE assignment maps to info tone", () => {
  assert.equal(getAssignmentTone("ACTIVE"), "info");
});

test("OVERDUE assignment maps to warning tone", () => {
  assert.equal(getAssignmentTone("OVERDUE"), "warning");
});

test("RETURNED assignment maps to success tone; CANCELLED maps to neutral", () => {
  assert.equal(getAssignmentTone("RETURNED"), "success");
  assert.equal(getAssignmentTone("CANCELLED"), "neutral");
});

test("getAssignmentBadgeClass returns a non-empty string", () => {
  const cls = getAssignmentBadgeClass("ACTIVE");
  assert.ok(typeof cls === "string" && cls.length > 0);
});

// ---------------------------------------------------------------------------
// Inventory type label + badge class
// ---------------------------------------------------------------------------

test("DURABLE inventory type returns non-empty label and badge class", () => {
  assert.ok(getInventoryTypeLabel("DURABLE").length > 0);
  assert.ok(getInventoryTypeBadgeClass("DURABLE").length > 0);
});

test("CONSUMABLE inventory type returns non-empty label and badge class", () => {
  assert.ok(getInventoryTypeLabel("CONSUMABLE").length > 0);
  assert.ok(getInventoryTypeBadgeClass("CONSUMABLE").length > 0);
});

// ---------------------------------------------------------------------------
// deriveItemConcernLevel
// ---------------------------------------------------------------------------

test("RETIRED lifecycle produces critical concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "RETIRED",
    conditionStatus: null,
    quantityOnHand: 5,
    quantityMin: null,
    readinessState: null,
  });
  assert.equal(level, "critical");
});

test("LOST lifecycle produces critical concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "LOST",
    conditionStatus: null,
    quantityOnHand: 1,
    quantityMin: null,
    readinessState: null,
  });
  assert.equal(level, "critical");
});

test("MAINTENANCE lifecycle produces warning concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "MAINTENANCE",
    conditionStatus: null,
    quantityOnHand: 5,
    quantityMin: null,
    readinessState: null,
  });
  assert.equal(level, "warning");
});

test("DAMAGED condition produces warning concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "ACTIVE",
    conditionStatus: "DAMAGED",
    quantityOnHand: 5,
    quantityMin: null,
    readinessState: null,
  });
  assert.equal(level, "warning");
});

test("low stock consumable produces warning concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "ACTIVE",
    conditionStatus: "GOOD",
    quantityOnHand: 2,
    quantityMin: 5,
    readinessState: null,
  });
  assert.equal(level, "warning");
});

test("NEEDS_INSPECTION readiness produces info concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "ACTIVE",
    conditionStatus: "GOOD",
    quantityOnHand: 1,
    quantityMin: null,
    readinessState: "NEEDS_INSPECTION",
  });
  assert.equal(level, "info");
});

test("fully healthy ACTIVE item with no concerns produces ok concern level", () => {
  const level: GearConcernLevel = deriveItemConcernLevel({
    lifecycleStatus: "ACTIVE",
    conditionStatus: "GOOD",
    quantityOnHand: 5,
    quantityMin: null,
    readinessState: "READY",
  });
  assert.equal(level, "ok");
});

// ---------------------------------------------------------------------------
// deriveAvailabilitySignal
// ---------------------------------------------------------------------------

test("ACTIVE with no checkout/assignment → AVAILABLE", () => {
  const signal: GearAvailabilitySignal = deriveAvailabilitySignal({
    lifecycleStatus: "ACTIVE",
    hasOpenCheckout: false,
    hasActiveAssignment: false,
  });
  assert.equal(signal, "AVAILABLE");
});

test("ACTIVE with open checkout → CHECKED_OUT", () => {
  const signal: GearAvailabilitySignal = deriveAvailabilitySignal({
    lifecycleStatus: "ACTIVE",
    hasOpenCheckout: true,
    hasActiveAssignment: false,
  });
  assert.equal(signal, "CHECKED_OUT");
});

test("ACTIVE with active assignment → ASSIGNED", () => {
  const signal: GearAvailabilitySignal = deriveAvailabilitySignal({
    lifecycleStatus: "ACTIVE",
    hasOpenCheckout: false,
    hasActiveAssignment: true,
  });
  assert.equal(signal, "ASSIGNED");
});

test("MAINTENANCE lifecycle → MAINTENANCE signal regardless of checkout/assignment", () => {
  const signal: GearAvailabilitySignal = deriveAvailabilitySignal({
    lifecycleStatus: "MAINTENANCE",
    hasOpenCheckout: true,
    hasActiveAssignment: true,
  });
  assert.equal(signal, "MAINTENANCE");
});

test("QUARANTINED lifecycle → MAINTENANCE signal", () => {
  assert.equal(
    deriveAvailabilitySignal({ lifecycleStatus: "QUARANTINED", hasOpenCheckout: false, hasActiveAssignment: false }),
    "MAINTENANCE",
  );
});

test("RETIRED lifecycle → RETIRED signal", () => {
  assert.equal(
    deriveAvailabilitySignal({ lifecycleStatus: "RETIRED", hasOpenCheckout: false, hasActiveAssignment: false }),
    "RETIRED",
  );
});

test("NEEDS_INSPECTION readiness → INSPECTION_NEEDED signal", () => {
  assert.equal(
    deriveAvailabilitySignal({
      lifecycleStatus: "ACTIVE",
      hasOpenCheckout: false,
      hasActiveAssignment: false,
      readinessState: "NEEDS_INSPECTION",
    }),
    "INSPECTION_NEEDED",
  );
});

test("OUT_OF_SERVICE inventory condition → MAINTENANCE signal", () => {
  assert.equal(
    deriveAvailabilitySignal({
      lifecycleStatus: "ACTIVE",
      hasOpenCheckout: false,
      hasActiveAssignment: false,
      inventoryCondition: "OUT_OF_SERVICE",
    }),
    "MAINTENANCE",
  );
});

test("RESERVED lifecycle with no explicit assignment → RESERVED signal", () => {
  assert.equal(
    deriveAvailabilitySignal({ lifecycleStatus: "RESERVED", hasOpenCheckout: false, hasActiveAssignment: false }),
    "RESERVED",
  );
});

test("ACTIVE with hard reservation visibility → RESERVED signal", () => {
  assert.equal(
    deriveAvailabilitySignal({
      lifecycleStatus: "ACTIVE",
      hasOpenCheckout: false,
      hasActiveAssignment: false,
      hasActiveReservation: true,
    }),
    "RESERVED",
  );
});

test("ACTIVE with soft hold visibility → HELD signal", () => {
  assert.equal(
    deriveAvailabilitySignal({
      lifecycleStatus: "ACTIVE",
      hasOpenCheckout: false,
      hasActiveAssignment: false,
      hasActiveHold: true,
    }),
    "HELD",
  );
});

// ---------------------------------------------------------------------------
// buildDashboardConcernSummary
// ---------------------------------------------------------------------------

test("no concerns produces success tone with ready label", () => {
  const summary = buildDashboardConcernSummary({
    maintenanceItems: 0,
    conditionConcernItems: 0,
    lowAvailabilityConsumables: 0,
    readinessConcerns: 0,
  });
  assert.equal(summary.overallTone, "success");
  assert.ok(typeof summary.overallLabel === "string" && summary.overallLabel.length > 0);
});

test("any maintenance items produce warning tone", () => {
  const summary = buildDashboardConcernSummary({
    maintenanceItems: 1,
    conditionConcernItems: 0,
    lowAvailabilityConsumables: 0,
    readinessConcerns: 0,
  });
  assert.ok(summary.overallTone === "warning" || summary.overallTone === "danger");
});

test("multiple concern types accumulate into warning count", () => {
  const summary = buildDashboardConcernSummary({
    maintenanceItems: 2,
    conditionConcernItems: 3,
    lowAvailabilityConsumables: 1,
    readinessConcerns: 4,
  });
  assert.equal(summary.warningCount, 2 + 3 + 1);
  assert.equal(summary.readinessConcernCount, 4);
  assert.ok(summary.overallTone !== "success");
});

// ---------------------------------------------------------------------------
// toneToChipClass / toneToBoxClass
// ---------------------------------------------------------------------------

test("toneToChipClass returns different strings for different tones", () => {
  const tones: LifecycleTone[] = ["success", "warning", "danger", "info", "neutral"];
  const classes = tones.map(toneToChipClass);
  const unique = new Set(classes);
  assert.equal(unique.size, tones.length);
});

test("toneToBoxClass returns different strings for different tones", () => {
  const tones: LifecycleTone[] = ["success", "warning", "danger", "info", "neutral"];
  const classes = tones.map(toneToBoxClass);
  const unique = new Set(classes);
  assert.equal(unique.size, tones.length);
});

test("toneToChipClass and toneToBoxClass return non-empty strings", () => {
  assert.ok(toneToChipClass("success").length > 0);
  assert.ok(toneToBoxClass("danger").length > 0);
});

// ---------------------------------------------------------------------------
// Lifecycle label
// ---------------------------------------------------------------------------

test("getLifecycleLabel returns readable text for all lifecycle statuses", () => {
  assert.equal(getLifecycleLabel("ACTIVE"), "Active");
  assert.equal(getLifecycleLabel("RESERVED"), "Reserved");
  assert.equal(getLifecycleLabel("ASSIGNED"), "Assigned");
  assert.equal(getLifecycleLabel("CHECKED_OUT"), "Checked out");
  assert.equal(getLifecycleLabel("MAINTENANCE"), "Maintenance");
  assert.equal(getLifecycleLabel("QUARANTINED"), "Quarantined");
  assert.equal(getLifecycleLabel("RETIRED"), "Retired");
  assert.equal(getLifecycleLabel("LOST"), "Lost");
});

// ---------------------------------------------------------------------------
// Condition label
// ---------------------------------------------------------------------------

test("getConditionLabel returns readable text for all condition statuses", () => {
  assert.equal(getConditionLabel("NEW"), "New");
  assert.equal(getConditionLabel("GOOD"), "Good");
  assert.equal(getConditionLabel("FAIR"), "Fair");
  assert.equal(getConditionLabel("POOR"), "Poor");
  assert.equal(getConditionLabel("DAMAGED"), "Damaged");
  assert.equal(getConditionLabel(null), "Unknown condition");
});

// ---------------------------------------------------------------------------
// Readiness label
// ---------------------------------------------------------------------------

test("getReadinessLabel returns readable text for all readiness states", () => {
  assert.equal(getReadinessLabel("READY"), "Ready");
  assert.equal(getReadinessLabel("NEEDS_INSPECTION"), "Needs inspection");
  assert.equal(getReadinessLabel("MAINTENANCE_REQUIRED"), "Maintenance needed");
  assert.equal(getReadinessLabel("NOT_READY"), "Not ready");
  assert.equal(getReadinessLabel("DECOMMISSIONED"), "Decommissioned");
  assert.equal(getReadinessLabel(null), "Readiness unknown");
});

// ---------------------------------------------------------------------------
// Checkout label
// ---------------------------------------------------------------------------

test("getCheckoutLabel returns readable text for all checkout statuses", () => {
  assert.equal(getCheckoutLabel("OPEN"), "Open");
  assert.equal(getCheckoutLabel("OVERDUE"), "Overdue");
  assert.equal(getCheckoutLabel("RETURNED"), "Returned");
  assert.equal(getCheckoutLabel("LOST"), "Lost");
});

// ---------------------------------------------------------------------------
// Assignment label
// ---------------------------------------------------------------------------

test("getAssignmentLabel returns readable text for all assignment statuses", () => {
  assert.equal(getAssignmentLabel("PENDING"), "Pending");
  assert.equal(getAssignmentLabel("ACTIVE"), "Active");
  assert.equal(getAssignmentLabel("OVERDUE"), "Overdue");
  assert.equal(getAssignmentLabel("RETURNED"), "Returned");
  assert.equal(getAssignmentLabel("TRANSFERRED"), "Transferred");
  assert.equal(getAssignmentLabel("CANCELLED"), "Cancelled");
});

// ---------------------------------------------------------------------------
// Availability signal label + chip class
// ---------------------------------------------------------------------------

test("getAvailabilitySignalLabel returns readable text for all signals", () => {
  assert.equal(getAvailabilitySignalLabel("AVAILABLE"), "Available");
  assert.equal(getAvailabilitySignalLabel("RESERVED"), "Reserved");
  assert.equal(getAvailabilitySignalLabel("HELD"), "Held");
  assert.equal(getAvailabilitySignalLabel("CHECKED_OUT"), "Checked out");
  assert.equal(getAvailabilitySignalLabel("INSPECTION_NEEDED"), "Inspection needed");
  assert.equal(getAvailabilitySignalLabel("RETIRED"), "Retired");
  assert.equal(getAvailabilitySignalLabel("ASSIGNED"), "Assigned");
  assert.equal(getAvailabilitySignalLabel("MAINTENANCE"), "Out of service");
  assert.equal(getAvailabilitySignalLabel("UNAVAILABLE"), "Unavailable");
});

test("getAvailabilitySignalChipClass returns non-empty class strings for all signals", () => {
  const signals: GearAvailabilitySignal[] = ["AVAILABLE", "RESERVED", "HELD", "CHECKED_OUT", "INSPECTION_NEEDED", "RETIRED", "ASSIGNED", "MAINTENANCE", "UNAVAILABLE"];
  const classes = signals.map(getAvailabilitySignalChipClass);
  classes.forEach((cls) => assert.ok(cls.length > 0, "Chip class must be non-empty"));
  assert.ok(getAvailabilitySignalChipClass("RESERVED").includes("violet"));
  assert.ok(getAvailabilitySignalChipClass("HELD").includes("sky"));
});

// ---------------------------------------------------------------------------
// getConcernLevelChipClass
// ---------------------------------------------------------------------------

test("getConcernLevelChipClass returns distinct non-empty class strings for all concern levels", () => {
  const levels: GearConcernLevel[] = ["critical", "warning", "info", "ok"];
  const classes = levels.map(getConcernLevelChipClass);
  const unique = new Set(classes);
  assert.equal(unique.size, levels.length, "Each concern level should map to a distinct chip class");
  classes.forEach((cls) => assert.ok(cls.length > 0, "Chip class must be non-empty"));
});

test("getConcernLevelChipClass critical maps to rose, ok maps to emerald", () => {
  assert.ok(getConcernLevelChipClass("critical").includes("rose"));
  assert.ok(getConcernLevelChipClass("ok").includes("emerald"));
});
