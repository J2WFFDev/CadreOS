import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildGearOpsExceptions,
  filterGearOpsItems,
  type GearOpsItemSnapshot,
  isLowConsumableItem,
  isMaintenanceNeededItem,
  isOutOfServiceItem,
  summarizeConsumables,
  summarizeCustody,
  summarizeEventRequirements,
  summarizeLocations,
  summarizeMaintenance,
  summarizeReadiness,
} from "../../lib/gear-ops-dashboard";

const now = new Date("2026-05-26T12:00:00Z");

function buildItem(overrides: Partial<Parameters<typeof filterGearOpsItems>[0][number]> = {}) {
  const base: GearOpsItemSnapshot = {
    id: "item-1",
    name: "Duty Radio",
    categoryId: "cat-radios",
    categoryName: "Radios",
    inventoryType: "DURABLE",
    lifecycleStatus: "ACTIVE",
    conditionStatus: "GOOD",
    ownershipType: "ORGANIZATION_OWNED",
    readinessState: "READY",
    locationId: "loc-vault",
    locationName: "Vault",
    quantityOnHand: 5,
    quantityMin: null,
    assignments: [],
    checkouts: [],
  };

  return {
    ...base,
    ...overrides,
  };
}

test("readiness summary reports counts and ready percentage", () => {
  const summary = summarizeReadiness([
    buildItem({ id: "a", readinessState: "READY" }),
    buildItem({ id: "b", readinessState: "READY" }),
    buildItem({ id: "c", readinessState: "NEEDS_INSPECTION" }),
    buildItem({ id: "d", readinessState: "MAINTENANCE_REQUIRED" }),
    buildItem({ id: "e", readinessState: "NOT_READY" }),
    buildItem({ id: "f", readinessState: null }),
  ]);

  assert.equal(summary.total, 6);
  assert.equal(summary.ready, 2);
  assert.equal(summary.needsInspection, 1);
  assert.equal(summary.maintenanceRequired, 1);
  assert.equal(summary.notReady, 1);
  assert.equal(summary.unspecified, 1);
  assert.equal(summary.readyPercent, 33);
});

test("maintenance detection separates out-of-service from maintenance-needed", () => {
  assert.equal(isOutOfServiceItem(buildItem({ lifecycleStatus: "QUARANTINED" })), true);
  assert.equal(isOutOfServiceItem(buildItem({ readinessState: "DECOMMISSIONED" })), true);
  assert.equal(isMaintenanceNeededItem(buildItem({ readinessState: "MAINTENANCE_REQUIRED" })), true);
  assert.equal(isMaintenanceNeededItem(buildItem({ conditionStatus: "DAMAGED" })), true);

  const summary = summarizeMaintenance([
    buildItem({ id: "oos", lifecycleStatus: "MAINTENANCE" }),
    buildItem({ id: "maint", readinessState: "MAINTENANCE_REQUIRED" }),
    buildItem({ id: "ok" }),
  ]);

  assert.equal(summary.outOfServiceCount, 1);
  assert.equal(summary.maintenanceNeededCount, 1);
  assert.equal(summary.totalConcernCount, 2);
});

test("custody summary reports active and overdue assignment and checkout load", () => {
  const summary = summarizeCustody(
    [
      {
        id: "asg-1",
        gearItemId: "item-1",
        status: "ACTIVE",
        expectedReturnAt: new Date("2026-05-20T00:00:00Z"),
        returnedAt: null,
        assignedToPersonId: "person-1",
        assignedToPersonName: "Alex Coach",
        assignedToEventId: null,
        assignedToEventTitle: null,
      },
      {
        id: "asg-2",
        gearItemId: "item-2",
        status: "PENDING",
        expectedReturnAt: null,
        returnedAt: null,
        assignedToPersonId: "person-2",
        assignedToPersonName: "Taylor Athlete",
        assignedToEventId: null,
        assignedToEventTitle: null,
      },
    ],
    [
      {
        id: "chk-1",
        gearItemId: "item-3",
        status: "OVERDUE",
        expectedReturnAt: null,
        returnedAt: null,
        checkedOutById: "person-2",
        checkedOutByName: "Taylor Athlete",
        eventId: "event-1",
        eventTitle: "Regional Match",
      },
    ],
    now,
  );

  assert.equal(summary.activeAssignments, 2);
  assert.equal(summary.openCheckouts, 1);
  assert.equal(summary.overdueAssignments, 1);
  assert.equal(summary.overdueCheckouts, 1);
  assert.equal(summary.holderCount, 2);
});

test("location summary groups by named and unassigned locations", () => {
  const locations = summarizeLocations([
    buildItem({ id: "a", locationId: "loc-a", locationName: "Vault A" }),
    buildItem({ id: "b", locationId: "loc-a", locationName: "Vault A" }),
    buildItem({ id: "c", locationId: null, locationName: null }),
  ]);

  assert.equal(locations[0]?.locationName, "Vault A");
  assert.equal(locations[0]?.count, 2);
  assert.equal(locations[1]?.locationName, "Unassigned location");
  assert.equal(locations[1]?.count, 1);
});

test("consumable summary identifies low stock and recent adjustments", () => {
  const lowConsumable = buildItem({
    id: "cons-1",
    inventoryType: "CONSUMABLE",
    quantityOnHand: 2,
    quantityMin: 3,
  });

  assert.equal(isLowConsumableItem(lowConsumable), true);

  const summary = summarizeConsumables(
    [lowConsumable, buildItem({ id: "cons-2", inventoryType: "CONSUMABLE", quantityOnHand: 9, quantityMin: 3 })],
    [
      {
        id: "txn-1",
        gearItemId: "cons-1",
        transactionType: "ADJUSTED",
        quantityDelta: -1,
        recordedAt: new Date("2026-05-10T00:00:00Z"),
      },
      {
        id: "txn-2",
        gearItemId: "cons-1",
        transactionType: "ADJUSTED",
        quantityDelta: 1,
        recordedAt: new Date("2026-03-01T00:00:00Z"),
      },
    ],
    now,
  );

  assert.equal(summary.lowConsumableCount, 1);
  assert.equal(summary.adjustmentCount30d, 1);
});

test("event requirement summary computes gaps and readiness percentage by event", () => {
  const summaries = summarizeEventRequirements([
    {
      eventId: "event-1",
      eventTitle: "Regional Match",
      quantityNeeded: 4,
      assignedCount: 3,
      readyCount: 2,
      unavailableCount: 1,
      outOfServiceCount: 0,
      maintenanceNeededCount: 0,
      deployedCount: 2,
      unreturnedCount: 1,
    },
    {
      eventId: "event-1",
      eventTitle: "Regional Match",
      quantityNeeded: 2,
      assignedCount: 2,
      readyCount: 2,
      unavailableCount: 0,
      outOfServiceCount: 0,
      maintenanceNeededCount: 0,
      deployedCount: 1,
      unreturnedCount: 0,
    },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.gapCount, 1);
  assert.equal(summaries[0]?.quantityNeeded, 6);
  assert.equal(summaries[0]?.readinessPercent, 67);
});

test("filtering supports category, location, event, owner, assignee, status, and readiness", () => {
  const items = [
    buildItem({
      id: "item-a",
      categoryId: "cat-radios",
      locationId: "loc-vault",
      lifecycleStatus: "ACTIVE",
      ownershipType: "ORGANIZATION_OWNED",
      readinessState: "READY",
      assignments: [
        {
          id: "asg-a",
          gearItemId: "item-a",
          status: "ACTIVE",
          expectedReturnAt: null,
          returnedAt: null,
          assignedToPersonId: "person-a",
          assignedToPersonName: "Coach A",
          assignedToEventId: "event-1",
          assignedToEventTitle: "Event 1",
        },
      ],
      checkouts: [],
    }),
    buildItem({
      id: "item-b",
      categoryId: "cat-firearms",
      locationId: "loc-cage",
      lifecycleStatus: "MAINTENANCE",
      ownershipType: "LOANED_IN",
      readinessState: "MAINTENANCE_REQUIRED",
      assignments: [],
      checkouts: [
        {
          id: "chk-b",
          gearItemId: "item-b",
          status: "OPEN",
          expectedReturnAt: null,
          returnedAt: null,
          checkedOutById: "person-b",
          checkedOutByName: "Athlete B",
          eventId: "event-2",
          eventTitle: "Event 2",
        },
      ],
    }),
  ];

  assert.equal(filterGearOpsItems(items, { categoryId: "cat-radios" }).length, 1);
  assert.equal(filterGearOpsItems(items, { locationId: "loc-cage" }).length, 1);
  assert.equal(filterGearOpsItems(items, { eventId: "event-1" }).length, 1);
  assert.equal(filterGearOpsItems(items, { owner: "LOANED_IN" }).length, 1);
  assert.equal(filterGearOpsItems(items, { assigneePersonId: "person-b" }).length, 1);
  assert.equal(filterGearOpsItems(items, { status: "MAINTENANCE" }).length, 1);
  assert.equal(filterGearOpsItems(items, { readiness: "READY" }).length, 1);
});

test("exceptions include overdue, maintenance, low consumable, and event gap/unreturned signals", () => {
  const exceptions = buildGearOpsExceptions({
    items: [
      buildItem({
        id: "item-oos",
        name: "Vault Radio",
        lifecycleStatus: "QUARANTINED",
        assignments: [
          {
            id: "asg-overdue",
            gearItemId: "item-oos",
            status: "ACTIVE",
            expectedReturnAt: new Date("2026-05-01T00:00:00Z"),
            returnedAt: null,
            assignedToPersonId: "person-1",
            assignedToPersonName: "Coach 1",
            assignedToEventId: null,
            assignedToEventTitle: null,
          },
        ],
        checkouts: [],
      }),
      buildItem({
        id: "item-cons",
        name: "Batteries",
        inventoryType: "CONSUMABLE",
        quantityOnHand: 1,
        quantityMin: 3,
      }),
    ],
    eventRequirements: [
      {
        eventId: "event-1",
        eventTitle: "Regional Match",
        quantityNeeded: 3,
        assignedCount: 1,
        readyCount: 1,
        unavailableCount: 0,
        outOfServiceCount: 0,
        maintenanceNeededCount: 0,
        deployedCount: 1,
        unreturnedCount: 1,
      },
    ],
    now,
  });

  assert.ok(exceptions.some((exception) => exception.kind === "OUT_OF_SERVICE"));
  assert.ok(exceptions.some((exception) => exception.kind === "OVERDUE_UNRETURNED"));
  assert.ok(exceptions.some((exception) => exception.kind === "LOW_CONSUMABLE"));
  assert.ok(exceptions.some((exception) => exception.kind === "EVENT_GEAR_GAP"));
  assert.ok(exceptions.some((exception) => exception.kind === "EVENT_GEAR_UNRETURNED"));
});

// ---------------------------------------------------------------------------
// summarizeOperationalRisk
// ---------------------------------------------------------------------------

import { summarizeOperationalRisk } from "../../lib/gear-ops-dashboard";

test("summarizeOperationalRisk returns five risk categories in order", () => {
  const risks = summarizeOperationalRisk({
    overdueCount: 2,
    maintenanceConcernCount: 1,
    lowConsumableCount: 0,
    eventGapCount: 3,
    eventUnreturnedCount: 1,
  });

  assert.equal(risks.length, 5);
  assert.equal(risks[0].key, "overdue");
  assert.equal(risks[1].key, "maintenance");
  assert.equal(risks[2].key, "consumable");
  assert.equal(risks[3].key, "event-gap");
  assert.equal(risks[4].key, "event-unreturned");
});

test("summarizeOperationalRisk marks non-zero counts as high or medium severity", () => {
  const risks = summarizeOperationalRisk({
    overdueCount: 1,
    maintenanceConcernCount: 2,
    lowConsumableCount: 1,
    eventGapCount: 0,
    eventUnreturnedCount: 0,
  });

  const overdue = risks.find((r) => r.key === "overdue");
  const maintenance = risks.find((r) => r.key === "maintenance");
  const consumable = risks.find((r) => r.key === "consumable");
  const eventGap = risks.find((r) => r.key === "event-gap");

  assert.equal(overdue?.severity, "high");
  assert.equal(maintenance?.severity, "high");
  assert.equal(consumable?.severity, "medium");
  assert.equal(eventGap?.severity, "low");
});

test("summarizeOperationalRisk marks zero-count categories as low severity", () => {
  const risks = summarizeOperationalRisk({
    overdueCount: 0,
    maintenanceConcernCount: 0,
    lowConsumableCount: 0,
    eventGapCount: 0,
    eventUnreturnedCount: 0,
  });

  risks.forEach((risk) => assert.equal(risk.severity, "low", `${risk.key} should be low severity`));
});

test("summarizeOperationalRisk each entry includes a non-empty href", () => {
  const risks = summarizeOperationalRisk({
    overdueCount: 0,
    maintenanceConcernCount: 0,
    lowConsumableCount: 0,
    eventGapCount: 0,
    eventUnreturnedCount: 0,
  });

  risks.forEach((risk) => assert.ok(risk.href.length > 0, `${risk.key} should have a non-empty href`));
});
