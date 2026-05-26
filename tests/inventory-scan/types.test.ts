import { strict as assert } from "node:assert";
import test from "node:test";

import {
  labelForScanContext,
  parseInventoryIdentifier,
  resolveScanTargetPath,
  validateInventoryCodeValue,
} from "../../lib/inventory-scan/types";

test("validateInventoryCodeValue rejects blank values", () => {
  const result = validateInventoryCodeValue(" ");
  assert.equal(result.valid, false);
});

test("parseInventoryIdentifier recognizes explicit prefixes", () => {
  const parsed = parseInventoryIdentifier("SN:ABC-123");
  assert.equal(parsed.identifierType, "SERIAL_NUMBER");
  assert.equal(parsed.normalizedValue, "ABC-123");
});

test("parseInventoryIdentifier recognizes implicit gear item IDs", () => {
  const parsed = parseInventoryIdentifier("c123456789012345678901234");
  assert.equal(parsed.identifierType, "GEAR_ITEM_ID");
});

test("resolveScanTargetPath routes checkout scans to checkout workflow", () => {
  const target = resolveScanTargetPath({
    scanContext: "CHECKOUT",
    scanValue: "ABC-001",
    match: {
      entityType: "GEAR_ITEM",
      id: "item-1",
      name: "Helmet",
      lifecycleStatus: "ACTIVE",
      identifierType: "BARCODE_VALUE",
      openCheckoutId: null,
    },
  });

  assert.ok(target.startsWith("/gear-ops/items/item-1/checkout?"));
});

test("resolveScanTargetPath routes check-in scans to active checkout edit when present", () => {
  const target = resolveScanTargetPath({
    scanContext: "CHECKIN",
    scanValue: "ABC-001",
    match: {
      entityType: "GEAR_ITEM",
      id: "item-1",
      name: "Helmet",
      lifecycleStatus: "CHECKED_OUT",
      identifierType: "BARCODE_VALUE",
      openCheckoutId: "co-1",
    },
  });

  assert.ok(target.startsWith("/gear-ops/items/item-1/checkouts/co-1/edit?"));
});

test("labelForScanContext returns readable labels", () => {
  assert.equal(labelForScanContext("INVENTORY_LOOKUP"), "Inventory lookup");
  assert.equal(labelForScanContext("CAGE_VAULT"), "Cage/vault");
});
