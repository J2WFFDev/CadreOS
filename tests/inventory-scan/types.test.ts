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

test("resolveScanTargetPath routes checkout scans to rapid item workflow", () => {
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

  assert.ok(target.startsWith("/gear-ops/items/item-1?"));
  assert.ok(target.includes("scanContext=CHECKOUT"));
  assert.ok(target.endsWith("#rapid-ops"));
});

test("resolveScanTargetPath routes check-in scans to rapid item workflow even with an active checkout", () => {
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

  assert.ok(target.startsWith("/gear-ops/items/item-1?"));
  assert.ok(target.includes("scanContext=CHECKIN"));
  assert.ok(target.endsWith("#rapid-ops"));
});

test("labelForScanContext returns readable labels", () => {
  assert.equal(labelForScanContext("INVENTORY_LOOKUP"), "Inventory lookup");
  assert.equal(labelForScanContext("CAGE_VAULT"), "Cage/vault");
});

import {
  isOpenCheckoutStatus,
  labelForIdentifierType,
  labelForScanEventResult,
  normalizeInventoryCodeValue,
} from "../../lib/inventory-scan/types";

// ---------------------------------------------------------------------------
// normalizeInventoryCodeValue
// ---------------------------------------------------------------------------

test("normalizeInventoryCodeValue trims leading and trailing whitespace", () => {
  assert.equal(normalizeInventoryCodeValue("  ABC-123  "), "ABC-123");
});

test("normalizeInventoryCodeValue collapses internal whitespace to single space", () => {
  assert.equal(normalizeInventoryCodeValue("ABC  123"), "ABC 123");
});

test("normalizeInventoryCodeValue returns empty string for whitespace-only input", () => {
  assert.equal(normalizeInventoryCodeValue("   "), "");
});

// ---------------------------------------------------------------------------
// labelForIdentifierType
// ---------------------------------------------------------------------------

test("labelForIdentifierType returns readable labels for all identifier types", () => {
  assert.equal(labelForIdentifierType("GEAR_ITEM_ID"), "Gear item ID");
  assert.equal(labelForIdentifierType("BARCODE_VALUE"), "Barcode/QR value");
  assert.equal(labelForIdentifierType("SERIAL_NUMBER"), "Serial number");
  assert.equal(labelForIdentifierType("SKU"), "SKU");
  assert.equal(labelForIdentifierType("LOCATION_CODE"), "Location code");
  assert.equal(labelForIdentifierType("UNKNOWN"), "Unknown");
});

// ---------------------------------------------------------------------------
// labelForScanEventResult
// ---------------------------------------------------------------------------

test("labelForScanEventResult returns readable labels for all scan results", () => {
  assert.equal(labelForScanEventResult("MATCHED_GEAR_ITEM"), "Matched gear item");
  assert.equal(labelForScanEventResult("MATCHED_LOCATION"), "Matched location");
  assert.equal(labelForScanEventResult("NOT_FOUND"), "No match found");
  assert.equal(labelForScanEventResult("INVALID"), "Invalid scan value");
});

// ---------------------------------------------------------------------------
// isOpenCheckoutStatus
// ---------------------------------------------------------------------------

test("isOpenCheckoutStatus returns true for OPEN", () => {
  assert.equal(isOpenCheckoutStatus("OPEN"), true);
});

test("isOpenCheckoutStatus returns true for OVERDUE", () => {
  assert.equal(isOpenCheckoutStatus("OVERDUE"), true);
});

test("isOpenCheckoutStatus returns false for RETURNED and LOST", () => {
  assert.equal(isOpenCheckoutStatus("RETURNED"), false);
  assert.equal(isOpenCheckoutStatus("LOST"), false);
});
