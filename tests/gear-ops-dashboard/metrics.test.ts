import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import {
  buildGearDashboardSummary,
  loadGearReservationDashboardMetrics,
  loadGearWorkflowDashboardMetrics,
} from "@/lib/gear-ops-dashboard-metrics";

function makePrismaKnownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("test error", {
    code,
    clientVersion: "0.0.0",
    meta,
  });
}

test("reservation metrics respect visibility scope across gear items, static kits, and dynamic kits", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const result = await loadGearReservationDashboardMetrics(
    {
      organizationId: "org_123",
      gearItemWhere: {
        organizationId: "org_123",
        OR: [{ programId: { in: ["program_1"] } }],
      },
      now: new Date("2026-06-01T12:00:00.000Z"),
    },
    {
      gearReservationCount: (async (args: Record<string, unknown>) => {
        calls.push(args);
        return calls.length;
      }) as typeof import("@/lib/db").db.gearReservation.count,
    },
  );

  assert.deepEqual(result, {
    activeReservations: 1,
    activeHolds: 2,
    upcomingReservations: 3,
    conflictingReservations: 4,
    unavailableReason: null,
  });
  assert.equal(calls.length, 4);

  for (const call of calls) {
    const where = call.where as { organizationId: string; OR: unknown[] };
    assert.equal(where.organizationId, "org_123");
    assert.equal(Array.isArray(where.OR), true);
    assert.equal(where.OR.length, 3);
  }
});

test("reservation metrics degrade safely when reservation schema is unavailable", async () => {
  const result = await loadGearReservationDashboardMetrics(
    {
      organizationId: "org_123",
      gearItemWhere: { organizationId: "org_123" },
    },
    {
      gearReservationCount: (async () => {
        throw makePrismaKnownRequestError("P2021", { table: "GearReservation" });
      }) as typeof import("@/lib/db").db.gearReservation.count,
    },
  );

  assert.deepEqual(result, {
    activeReservations: 0,
    activeHolds: 0,
    upcomingReservations: 0,
    conflictingReservations: 0,
    unavailableReason: 'Unavailable: table "GearReservation" is missing.',
  });
});

test("reservation metrics do not crash when no dynamic kit reservations exist", async () => {
  const result = await loadGearReservationDashboardMetrics(
    {
      organizationId: "org_123",
      gearItemWhere: {
        organizationId: "org_123",
        OR: [{ programId: { in: ["program_1"] } }],
      },
    },
    {
      gearReservationCount: (async () => 0) as typeof import("@/lib/db").db.gearReservation.count,
    },
  );

  assert.deepEqual(result, {
    activeReservations: 0,
    activeHolds: 0,
    upcomingReservations: 0,
    conflictingReservations: 0,
    unavailableReason: null,
  });
});

test("workflow metrics do not crash when no linked EntryOps tasks exist", async () => {
  const result = await loadGearWorkflowDashboardMetrics(
    {
      organizationId: "org_123",
      limit: 5,
    },
    {
      countOpenGearWorkflowTasksByCategory: (async () => 0) as typeof import("@/lib/gear-ops-workflows").countOpenGearWorkflowTasksByCategory,
      listOpenGearWorkflowTasks: (async () => []) as typeof import("@/lib/gear-ops-workflows").listOpenGearWorkflowTasks,
    },
  );

  assert.deepEqual(result, {
    openMaintenanceWorkflowTasks: 0,
    openMissingWorkflowTasks: 0,
    openDamageWorkflowTasks: 0,
    recentWorkflowTasks: [],
    unavailableReason: null,
  });
});

test("workflow metrics degrade safely when EntryOps-linked schema is unavailable", async () => {
  const result = await loadGearWorkflowDashboardMetrics(
    {
      organizationId: "org_123",
      limit: 5,
    },
    {
      countOpenGearWorkflowTasksByCategory: (async () => {
        throw makePrismaKnownRequestError("P2022", { column: "Entry.tags" });
      }) as typeof import("@/lib/gear-ops-workflows").countOpenGearWorkflowTasksByCategory,
      listOpenGearWorkflowTasks: (async () => []) as typeof import("@/lib/gear-ops-workflows").listOpenGearWorkflowTasks,
    },
  );

  assert.deepEqual(result, {
    openMaintenanceWorkflowTasks: 0,
    openMissingWorkflowTasks: 0,
    openDamageWorkflowTasks: 0,
    recentWorkflowTasks: [],
    unavailableReason: 'Unavailable: column "Entry.tags" is missing.',
  });
});

test("dashboard summary returns zero counts for empty data", () => {
  const summary = buildGearDashboardSummary({
    core: {
      totalCategories: 0,
      totalItems: 0,
      durableItems: 0,
      consumableItems: 0,
      activeAvailableItems: 0,
      assignedOrCheckedOutItems: 0,
      maintenanceItems: 0,
      conditionConcernItems: 0,
      activeAssignmentRecords: 0,
      openCheckoutRecords: 0,
      lowAvailabilityConsumablesCount: 0,
      consumableUsageUnits30d: 0,
      consumableReplenishmentUnits30d: 0,
      consumableNetDelta30d: 0,
    },
    reservations: {
      activeReservations: 0,
      activeHolds: 0,
      upcomingReservations: 0,
      conflictingReservations: 0,
    },
  });

  assert.deepEqual(summary, {
    totalCategories: 0,
    totalItems: 0,
    durableItems: 0,
    consumableItems: 0,
    activeAvailableItems: 0,
    assignedOrCheckedOutItems: 0,
    maintenanceItems: 0,
    conditionConcernItems: 0,
    activeAssignmentRecords: 0,
    openCheckoutRecords: 0,
    activeReservations: 0,
    activeHolds: 0,
    upcomingReservations: 0,
    conflictingReservations: 0,
    lowAvailabilityConsumables: 0,
    consumableUsageUnits30d: 0,
    consumableReplenishmentUnits30d: 0,
    consumableNetDelta30d: 0,
    readinessConcerns: 0,
  });
});

test("dashboard readiness concerns exclude open checkouts from warning totals", () => {
  const summary = buildGearDashboardSummary({
    core: {
      totalCategories: 1,
      totalItems: 4,
      durableItems: 3,
      consumableItems: 1,
      activeAvailableItems: 2,
      assignedOrCheckedOutItems: 2,
      maintenanceItems: 1,
      conditionConcernItems: 1,
      activeAssignmentRecords: 1,
      openCheckoutRecords: 5,
      lowAvailabilityConsumablesCount: 1,
      consumableUsageUnits30d: 0,
      consumableReplenishmentUnits30d: 0,
      consumableNetDelta30d: 0,
    },
    reservations: {
      activeReservations: 0,
      activeHolds: 0,
      upcomingReservations: 0,
      conflictingReservations: 0,
    },
  });

  assert.equal(summary.readinessConcerns, 3);
});
