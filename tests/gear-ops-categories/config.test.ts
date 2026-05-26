
import { strict as assert } from "node:assert";
import test from "node:test";

import {
  applyGearCategoryTemplate,
  formatGearCategoryBehavior,
  formatGearCustodyMode,
  formatGearIdentifierType,
  formatGearReportGroup,
  GEAR_CATEGORY_STARTER_TEMPLATES,
  getGearCategoryTemplate,
  getReportGroupBadgeClass,
  isCategoryConsumable,
  isCategoryDurable,
} from "../../lib/gear-category-config";

test("template lookup returns each configured starter template", () => {
  for (const template of GEAR_CATEGORY_STARTER_TEMPLATES) {
    const found = getGearCategoryTemplate(template.slug);
    assert.ok(found);
    assert.equal(found.slug, template.slug);
  }
});

test("firearm template defaults match expected admin configuration", () => {
  const firearm = getGearCategoryTemplate("firearm");
  assert.ok(firearm);
  assert.equal(firearm.defaults.custodyMode, "STAFF_ASSIGNMENT_ONLY");
  assert.equal(firearm.defaults.reportGroup, "FIREARMS");
  assert.equal(firearm.defaults.primaryIdentifierType, "SERIAL_NUMBER");
});

test("ammunition template is consumable with low-stock and no-custody defaults", () => {
  const ammunition = getGearCategoryTemplate("ammunition");
  assert.ok(ammunition);
  assert.equal(ammunition.defaults.inventoryType, "CONSUMABLE");
  assert.equal(ammunition.defaults.consumableLowStockDefault, 50);
  assert.equal(ammunition.defaults.custodyMode, "NO_CUSTODY");
});

test("isCategoryDurable identifies durable behavior types", () => {
  assert.equal(isCategoryDurable("DURABLE"), true);
  assert.equal(isCategoryDurable("CONSUMABLE"), false);
});

test("isCategoryConsumable identifies consumable behavior types", () => {
  assert.equal(isCategoryConsumable("CONSUMABLE"), true);
  assert.equal(isCategoryConsumable("DURABLE"), false);
});

test("format helpers humanize core GearOps enum values", () => {
  assert.equal(formatGearCategoryBehavior("ASSIGNED_GEAR"), "Assigned Gear");
  assert.equal(formatGearCustodyMode("STAFF_ASSIGNMENT_ONLY"), "Staff Assignment Only");
  assert.equal(formatGearIdentifierType("SERIAL_NUMBER"), "Serial Number");
  assert.equal(formatGearReportGroup("VEHICLES_LARGE_EQUIPMENT"), "Vehicles Large Equipment");
});

test("unknown template lookup returns undefined", () => {
  assert.equal(getGearCategoryTemplate("unknown-template"), undefined);
});

test("applyGearCategoryTemplate returns the stored defaults for known templates", () => {
  const templateDefaults = applyGearCategoryTemplate("radio");
  assert.equal(templateDefaults.custodyMode, "FREE_CHECKOUT");
  assert.equal(templateDefaults.primaryIdentifierType, "ASSET_TAG");
  assert.equal(templateDefaults.requiresMaintenanceTracking, true);
});

test("all twelve starter templates are available", () => {
  assert.equal(GEAR_CATEGORY_STARTER_TEMPLATES.length, 12);
});

test("report group badge classes return non-empty values", () => {
  for (const group of ["GENERAL", "FIREARMS", "MEDICAL", "CONSUMABLES"] as const) {
    assert.ok(getReportGroupBadgeClass(group).length > 0);
  }
});
