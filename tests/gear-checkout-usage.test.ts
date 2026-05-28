import { strict as assert } from "node:assert";
import test from "node:test";

import { GearCheckoutStatus, GearConditionStatus, GearItemLifecycleStatus } from "@prisma/client";

import {
  buildGearCheckoutReturnNotes,
  buildGearCheckoutUsageHistoryLabel,
  deriveGearItemCheckinUpdate,
  isMaintenanceConditionOnReturn,
  parseGearCheckoutReturnNotes,
} from "../lib/gear-checkout-usage";

test("buildGearCheckoutReturnNotes stores usage log ahead of return notes", () => {
  assert.equal(
    buildGearCheckoutReturnNotes({
      usageLog: "Practice · estimated 90 minutes",
      returnNotes: "Battery swapped after check-in.",
    }),
    "Usage log: Practice · estimated 90 minutes\n\nBattery swapped after check-in.",
  );
});

test("buildGearCheckoutReturnNotes omits empty sections", () => {
  assert.equal(
    buildGearCheckoutReturnNotes({
      usageLog: "  ",
      returnNotes: "  ",
    }),
    null,
  );
});

test("parseGearCheckoutReturnNotes splits stored usage log from operator notes", () => {
  assert.deepEqual(
    parseGearCheckoutReturnNotes("Usage log: Match · estimated 120 rounds\n\nNo damage on return."),
    {
      usageLog: "Match · estimated 120 rounds",
      returnNotes: "No damage on return.",
    },
  );
});

test("parseGearCheckoutReturnNotes leaves legacy return notes untouched", () => {
  assert.deepEqual(parseGearCheckoutReturnNotes("Legacy note only"), {
    usageLog: "",
    returnNotes: "Legacy note only",
  });
});

test("buildGearCheckoutUsageHistoryLabel returns null when no usage log exists", () => {
  assert.equal(buildGearCheckoutUsageHistoryLabel(""), null);
});

test("deriveGearItemCheckinUpdate flags returned damaged item for maintenance follow-up", () => {
  const update = deriveGearItemCheckinUpdate({
    checkoutStatus: GearCheckoutStatus.RETURNED,
    conditionOnReturn: GearConditionStatus.DAMAGED,
    currentLifecycleStatus: GearItemLifecycleStatus.CHECKED_OUT,
  });

  assert.equal(update.conditionStatus, GearConditionStatus.DAMAGED);
  assert.equal(update.readinessState, "MAINTENANCE_REQUIRED");
  assert.equal(update.lifecycleStatus, GearItemLifecycleStatus.MAINTENANCE);
  assert.equal(update.needsMaintenanceFollowUp, true);
});

test("deriveGearItemCheckinUpdate restores checked-out lifecycle to active on normal return", () => {
  const update = deriveGearItemCheckinUpdate({
    checkoutStatus: GearCheckoutStatus.RETURNED,
    conditionOnReturn: GearConditionStatus.GOOD,
    currentLifecycleStatus: GearItemLifecycleStatus.CHECKED_OUT,
  });

  assert.equal(update.conditionStatus, GearConditionStatus.GOOD);
  assert.equal(update.readinessState, undefined);
  assert.equal(update.lifecycleStatus, GearItemLifecycleStatus.ACTIVE);
  assert.equal(update.needsMaintenanceFollowUp, false);
});

test("deriveGearItemCheckinUpdate returns no changes while checkout is still open", () => {
  const update = deriveGearItemCheckinUpdate({
    checkoutStatus: GearCheckoutStatus.OPEN,
    conditionOnReturn: GearConditionStatus.DAMAGED,
    currentLifecycleStatus: GearItemLifecycleStatus.CHECKED_OUT,
  });

  assert.equal(update.conditionStatus, undefined);
  assert.equal(update.readinessState, undefined);
  assert.equal(update.lifecycleStatus, undefined);
  assert.equal(update.needsMaintenanceFollowUp, false);
});

test("isMaintenanceConditionOnReturn detects POOR and DAMAGED only", () => {
  assert.equal(isMaintenanceConditionOnReturn(GearConditionStatus.POOR), true);
  assert.equal(isMaintenanceConditionOnReturn(GearConditionStatus.DAMAGED), true);
  assert.equal(isMaintenanceConditionOnReturn(GearConditionStatus.GOOD), false);
  assert.equal(isMaintenanceConditionOnReturn(null), false);
});
