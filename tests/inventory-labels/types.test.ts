import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildDisplayReference,
  buildLabelFileName,
  buildOrganizationIdentifier,
  buildStatusPresentation,
  INVENTORY_LABEL_TEMPLATES,
  labelForInventoryLabelFormat,
  labelForInventoryLabelTemplate,
  resolveLabelFormatClasses,
} from "../../lib/inventory-labels/types";

test("inventory label template helpers expose readable labels", () => {
  assert.equal(labelForInventoryLabelTemplate("INVENTORY_ITEM"), "Inventory label");
  assert.equal(labelForInventoryLabelTemplate("KIT_LOADOUT"), "Kit / loadout label");
  assert.equal(labelForInventoryLabelFormat("WIDE"), "Wide");
});

test("organization identifier helper builds stable operational identifiers", () => {
  assert.equal(buildOrganizationIdentifier("Cadre Ops North", "org_c1234abcd"), "CON-ABCD");
});

test("display reference helper creates compact printable refs", () => {
  assert.equal(buildDisplayReference("INV", "c1234567890"), "INV-567890");
});

test("status presentation prioritizes readiness, then lifecycle, then active state", () => {
  assert.deepEqual(buildStatusPresentation({ readinessState: "READY", lifecycleStatus: "MAINTENANCE" }), {
    label: "Readiness · Ready",
    tone: "ready",
  });
  assert.deepEqual(buildStatusPresentation({ lifecycleStatus: "MAINTENANCE" }), {
    label: "Lifecycle · Maintenance",
    tone: "attention",
  });
  assert.deepEqual(buildStatusPresentation({ isActive: false }), {
    label: "Inactive",
    tone: "inactive",
  });
});

test("label format classes return print-friendly layouts", () => {
  const compact = resolveLabelFormatClasses("COMPACT");
  assert.ok(compact.wrapper.includes("max-w"));
  assert.ok(compact.grid.includes("grid-cols"));
  assert.ok(compact.symbol.includes("h-"));
});

test("label file name helper generates stable printable names", () => {
  assert.equal(
    buildLabelFileName({ templateKey: "INVENTORY_ITEM", subjectName: "Team Helmet #4", subjectId: "item-123456" }),
    "inventory_item-team-helmet-4.html",
  );
});

test("temporary operational template stays QR only", () => {
  assert.deepEqual(INVENTORY_LABEL_TEMPLATES.TEMPORARY_OPERATIONAL.symbolKinds, ["QR"]);
});
