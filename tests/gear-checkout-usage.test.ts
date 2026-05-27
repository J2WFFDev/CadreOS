import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildGearCheckoutReturnNotes,
  buildGearCheckoutUsageHistoryLabel,
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
