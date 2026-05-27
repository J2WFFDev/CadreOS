import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildGearOpsSchemaUnavailableMessage,
  evaluateGearOpsSchemaStatus,
  getGearOpsSchemaRequirements,
} from "../../lib/gear-ops-schema-status";

function buildAvailableColumns(scope: Parameters<typeof getGearOpsSchemaRequirements>[0]) {
  return new Map(
    getGearOpsSchemaRequirements(scope).map((requirement) => [requirement.table, new Set(requirement.columns)]),
  );
}

test("item-creation readiness is true when all required Prisma-backed tables and columns exist", () => {
  const requirements = getGearOpsSchemaRequirements("item-creation");
  const availableTables = requirements.map((requirement) => requirement.table);
  const status = evaluateGearOpsSchemaStatus({
    scope: "item-creation",
    availableTables,
    availableColumnsByTable: buildAvailableColumns("item-creation"),
  });

  assert.equal(status.schemaReady, true);
  assert.deepEqual(status.missingTables, []);
  assert.deepEqual(status.missingColumns, []);
  assert.equal(status.setupRequired, false);
  assert.deepEqual(status.pendingActions, []);
});

test("reports readiness enumerates missing columns instead of using stale names", () => {
  const requirements = getGearOpsSchemaRequirements("reports");
  const availableTables = requirements.map((requirement) => requirement.table);
  const availableColumnsByTable = buildAvailableColumns("reports");
  availableColumnsByTable.get("GearItem")?.delete("inspectionDueStatus");
  availableColumnsByTable.get("GearReservation")?.delete("windowEndAt");

  const status = evaluateGearOpsSchemaStatus({
    scope: "reports",
    availableTables,
    availableColumnsByTable,
  });

  assert.equal(status.schemaReady, false);
  assert.deepEqual(status.missingTables, []);
  assert.deepEqual(status.missingColumns, ["GearItem.inspectionDueStatus", "GearReservation.windowEndAt"]);
  assert.equal(status.setupRequired, true);
  assert.ok(status.pendingActions.some((entry) => entry.includes("GearItem.inspectionDueStatus")));
});

test("kits readiness lists missing tables for shared screens", () => {
  const status = evaluateGearOpsSchemaStatus({
    scope: "kits",
    availableTables: ["InventoryKit"],
    availableColumnsByTable: new Map([
      [
        "InventoryKit",
        new Set([
          "organizationId",
          "name",
          "description",
          "kitType",
          "ownerPersonId",
          "assignedToPersonId",
          "readinessLabel",
          "custodyStatus",
          "lastInspectionStatus",
          "isActive",
        ]),
      ],
    ]),
  });

  assert.equal(status.schemaReady, false);
  assert.deepEqual(status.missingTables, ["InventoryKitItem"]);
  assert.ok(status.pendingActions.some((entry) => entry.startsWith("Create missing tables:")));
});

test("item-creation readiness requires the shared Program lookup table but not unrelated location columns", () => {
  const status = evaluateGearOpsSchemaStatus({
    scope: "item-creation",
    availableTables: ["GearCategory", "GearItem"],
    availableColumnsByTable: new Map([
      ["GearCategory", new Set(["organizationId", "name", "inventoryType"])],
      [
        "GearItem",
        new Set([
          "organizationId",
          "programId",
          "gearCategoryId",
          "name",
          "inventoryType",
          "sku",
          "serialNumber",
          "quantityOnHand",
          "quantityMin",
          "lifecycleStatus",
          "conditionStatus",
          "barcodeValue",
          "notes",
        ]),
      ],
    ]),
  });

  assert.equal(status.schemaReady, false);
  assert.deepEqual(status.missingTables, ["Program"]);
  assert.deepEqual(status.missingColumns, []);
});

test("audits readiness no longer blocks the list screen on unrelated reconciliation tables", () => {
  const status = evaluateGearOpsSchemaStatus({
    scope: "audits",
    availableTables: ["InventoryAudit", "InventoryAuditSession"],
    availableColumnsByTable: new Map([
      [
        "InventoryAudit",
        new Set(["organizationId", "name", "description", "auditType", "scope", "nextScheduledAt", "lastExecutedAt", "archivedAt"]),
      ],
      [
        "InventoryAuditSession",
        new Set(["organizationId", "inventoryAuditId", "status", "startedAt", "completedAt"]),
      ],
    ]),
  });

  assert.equal(status.schemaReady, true);
  assert.deepEqual(status.missingTables, []);
  assert.deepEqual(status.missingColumns, []);
});

test("schema unavailable message includes explicit missing tables and columns", () => {
  const message = buildGearOpsSchemaUnavailableMessage(
    {
      missingTables: ["InventoryAudit"],
      missingColumns: ["GearItem.inspectionDueStatus"],
    },
    "Run database setup before loading inventory audits.",
  );

  assert.equal(
    message,
    "Database schema is not available yet (tables: InventoryAudit | columns: GearItem.inspectionDueStatus). Run database setup before loading inventory audits.",
  );
});

test("item-list readiness is true when all required tables and columns exist", () => {
  const requirements = getGearOpsSchemaRequirements("item-list");
  const availableTables = requirements.map((requirement) => requirement.table);
  const status = evaluateGearOpsSchemaStatus({
    scope: "item-list",
    availableTables,
    availableColumnsByTable: buildAvailableColumns("item-list"),
  });

  assert.equal(status.schemaReady, true);
  assert.deepEqual(status.missingTables, []);
  assert.deepEqual(status.missingColumns, []);
  assert.equal(status.setupRequired, false);
  assert.deepEqual(status.pendingActions, []);
});

test("item-list readiness does not require InventoryMovement or InventoryScanEvent", () => {
  const requirements = getGearOpsSchemaRequirements("item-list");
  const requiredTables = requirements.map((r) => r.table);

  assert.ok(!requiredTables.includes("InventoryMovement"), "item-list must not require InventoryMovement");
  assert.ok(!requiredTables.includes("InventoryScanEvent"), "item-list must not require InventoryScanEvent");
});

test("item-list readiness does not require optional custody or maintenance tables", () => {
  const requirements = getGearOpsSchemaRequirements("item-list");
  const requiredTables = requirements.map((r) => r.table);

  assert.ok(!requiredTables.includes("GearAssignment"), "item-list must not require GearAssignment");
  assert.ok(!requiredTables.includes("GearCheckout"), "item-list must not require GearCheckout");
  assert.ok(!requiredTables.includes("GearMaintenanceLog"), "item-list must not require GearMaintenanceLog");
  assert.ok(!requiredTables.includes("ConsumableTransaction"), "item-list must not require ConsumableTransaction");
});

test("item-list readiness reports missing GearItem table", () => {
  const requirements = getGearOpsSchemaRequirements("item-list");
  const availableTables = requirements.map((r) => r.table).filter((t) => t !== "GearItem");
  const availableColumnsByTable = buildAvailableColumns("item-list");
  availableColumnsByTable.delete("GearItem");

  const status = evaluateGearOpsSchemaStatus({
    scope: "item-list",
    availableTables,
    availableColumnsByTable,
  });

  assert.equal(status.schemaReady, false);
  assert.ok(status.missingTables.includes("GearItem"));
  assert.equal(status.setupRequired, true);
});

test("item-detail readiness is true when all required tables and columns exist", () => {
  const requirements = getGearOpsSchemaRequirements("item-detail");
  const availableTables = requirements.map((requirement) => requirement.table);
  const status = evaluateGearOpsSchemaStatus({
    scope: "item-detail",
    availableTables,
    availableColumnsByTable: buildAvailableColumns("item-detail"),
  });

  assert.equal(status.schemaReady, true);
  assert.deepEqual(status.missingTables, []);
  assert.deepEqual(status.missingColumns, []);
  assert.equal(status.setupRequired, false);
  assert.deepEqual(status.pendingActions, []);
});

test("item-detail readiness does not require InventoryMovement or InventoryScanEvent", () => {
  const requirements = getGearOpsSchemaRequirements("item-detail");
  const requiredTables = requirements.map((r) => r.table);

  assert.ok(!requiredTables.includes("InventoryMovement"), "item-detail must not require InventoryMovement");
  assert.ok(!requiredTables.includes("InventoryScanEvent"), "item-detail must not require InventoryScanEvent");
});

test("item-detail readiness reports missing InventoryLocation table", () => {
  const requirements = getGearOpsSchemaRequirements("item-detail");
  const availableTables = requirements.map((r) => r.table).filter((t) => t !== "InventoryLocation");
  const availableColumnsByTable = buildAvailableColumns("item-detail");
  availableColumnsByTable.delete("InventoryLocation");

  const status = evaluateGearOpsSchemaStatus({
    scope: "item-detail",
    availableTables,
    availableColumnsByTable,
  });

  assert.equal(status.schemaReady, false);
  assert.ok(status.missingTables.includes("InventoryLocation"));
  assert.equal(status.setupRequired, true);
});

test("item-detail readiness reports missing GearReservation but item-list does not", () => {
  const listRequirements = getGearOpsSchemaRequirements("item-list");
  const detailRequirements = getGearOpsSchemaRequirements("item-detail");

  const listTables = listRequirements.map((r) => r.table);
  const detailTables = detailRequirements.map((r) => r.table);

  assert.ok(!listTables.includes("GearReservation"), "item-list must not require GearReservation");
  assert.ok(detailTables.includes("GearReservation"), "item-detail must require GearReservation");
});
