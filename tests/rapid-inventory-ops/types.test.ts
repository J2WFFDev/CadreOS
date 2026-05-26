import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildRapidOperationHref,
  findRapidOperationPresetByScanContext,
  INVENTORY_ACTION_PRESETS,
  resolveMobileInventoryActions,
} from "../../lib/rapid-inventory-ops";

test("inventory rapid presets cover each supported scan context", () => {
  assert.equal(INVENTORY_ACTION_PRESETS.length, 7);
  assert.equal(findRapidOperationPresetByScanContext("CHECKOUT").title, "Rapid check-out");
  assert.equal(findRapidOperationPresetByScanContext("AUDIT_PREP").operationContext, "AUDIT");
});

test("buildRapidOperationHref preserves scan context and optional scan value", () => {
  assert.equal(buildRapidOperationHref("CHECKIN"), "/gear-ops/scan?scanContext=CHECKIN");
  assert.equal(
    buildRapidOperationHref("ASSIGNMENT", "BC-004"),
    "/gear-ops/scan?scanContext=ASSIGNMENT&scanValue=BC-004",
  );
});

test("resolveMobileInventoryActions prefers active checkout flow for check-in context", () => {
  const resolved = resolveMobileInventoryActions({
    itemId: "item-1",
    inventoryType: "DURABLE",
    lifecycleStatus: "CHECKED_OUT",
    readinessState: "READY",
    scanContext: "CHECKIN",
    nowInputValue: "2026-05-26T17:18",
    currentCheckoutId: "checkout-1",
    currentAssignmentId: null,
    locationId: "loc-1",
  });

  assert.equal(resolved.primaryAction.key, "checkin");
  assert.ok(resolved.primaryAction.href.includes("/gear-ops/items/item-1/checkouts/checkout-1/edit"));
  assert.equal(resolved.quickCustodyFlows.length, 3);
});

test("resolveMobileInventoryActions exposes consumable adjustment and fallback movement history", () => {
  const resolved = resolveMobileInventoryActions({
    itemId: "item-2",
    inventoryType: "CONSUMABLE",
    lifecycleStatus: "ACTIVE",
    readinessState: null,
    scanContext: "CAGE_VAULT",
    nowInputValue: "2026-05-26T17:18",
    currentCheckoutId: null,
    currentAssignmentId: "assignment-1",
    locationId: null,
  });

  assert.equal(resolved.primaryAction.key, "movement-history");
  assert.ok(resolved.actions.some((action) => action.key === "consumable-adjust"));
  assert.ok(resolved.actions.some((action) => action.key === "assignment-update"));
});
