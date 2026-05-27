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
    availableTables: ["GearItem", "InventoryKit"],
    availableColumnsByTable: new Map([
      ["GearItem", new Set(["organizationId", "name", "inventoryType", "lifecycleStatus"])],
      [
        "InventoryKit",
        new Set([
          "organizationId",
          "name",
          "kitType",
          "ownerPersonId",
          "assignedToPersonId",
          "assignedToTeamId",
          "assignedToEventId",
          "labelCode",
          "readinessLabel",
          "custodyStatus",
          "lastInspectedAt",
          "lastInspectionStatus",
          "isActive",
        ]),
      ],
    ]),
  });

  assert.equal(status.schemaReady, false);
  assert.deepEqual(status.missingTables, ["GearKitCustodyEvent", "GearKitInspection", "InventoryKitItem"]);
  assert.ok(status.pendingActions.some((entry) => entry.startsWith("Create missing tables:")));
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
