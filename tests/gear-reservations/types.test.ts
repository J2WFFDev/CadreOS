import { strict as assert } from "node:assert";
import test from "node:test";

import {
  deriveGearReservationEffectiveStatus,
  evaluateGearReservationConflicts,
  findReservationToFulfill,
  summarizeGearReservations,
  windowsOverlap,
} from "../../lib/gear-reservations";

const now = new Date("2026-05-26T12:00:00Z");

test("effective status becomes expired when active reservation window ends", () => {
  assert.equal(
    deriveGearReservationEffectiveStatus(
      {
        status: "ACTIVE",
        windowEndAt: new Date("2026-05-20T00:00:00Z"),
      },
      now,
    ),
    "EXPIRED",
  );
});

test("window overlap helper matches intersecting windows only", () => {
  assert.equal(
    windowsOverlap(
      new Date("2026-05-26T10:00:00Z"),
      new Date("2026-05-26T12:00:00Z"),
      new Date("2026-05-26T11:00:00Z"),
      new Date("2026-05-26T13:00:00Z"),
    ),
    true,
  );
  assert.equal(
    windowsOverlap(
      new Date("2026-05-26T10:00:00Z"),
      new Date("2026-05-26T11:00:00Z"),
      new Date("2026-05-26T11:00:00Z"),
      new Date("2026-05-26T12:00:00Z"),
    ),
    false,
  );
});

test("conflict evaluation blocks overlapping hard reservations and open custody", () => {
  const conflicts = evaluateGearReservationConflicts({
    lifecycleStatus: "ACTIVE",
    readinessState: "READY",
    inventoryType: "DURABLE",
    quantityOnHand: 1,
    currentOpenCheckoutCount: 1,
    currentAssignmentCount: 0,
    requestedMode: "HARD_RESERVATION",
    requestedHoldType: null,
    requestedQuantity: 1,
    requestedWindowStartAt: new Date("2026-05-27T10:00:00Z"),
    requestedWindowEndAt: new Date("2026-05-27T12:00:00Z"),
    approvalRequired: false,
    existingReservations: [
      {
        id: "res-1",
        gearItemId: "item-1",
        mode: "HARD_RESERVATION",
        status: "ACTIVE",
        approvalStatus: "NOT_REQUIRED",
        holdType: null,
        purpose: "EVENT",
        quantityRequested: 1,
        windowStartAt: new Date("2026-05-27T09:00:00Z"),
        windowEndAt: new Date("2026-05-27T11:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: null,
        reservedForEventId: "event-1",
        programId: null,
        conflictSummary: null,
      },
    ],
  });

  assert.ok(conflicts.some((conflict) => conflict.code === "OPEN_CHECKOUT"));
  assert.ok(conflicts.some((conflict) => conflict.code === "OVERLAPPING_RESERVATION"));
});

test("soft holds warn while consumable shortages block", () => {
  const conflicts = evaluateGearReservationConflicts({
    lifecycleStatus: "ACTIVE",
    readinessState: "READY",
    inventoryType: "CONSUMABLE",
    quantityOnHand: 4,
    currentOpenCheckoutCount: 0,
    currentAssignmentCount: 0,
    requestedMode: "SOFT_HOLD",
    requestedHoldType: null,
    requestedQuantity: 3,
    requestedWindowStartAt: new Date("2026-05-27T10:00:00Z"),
    requestedWindowEndAt: new Date("2026-05-27T12:00:00Z"),
    approvalRequired: false,
    existingReservations: [
      {
        id: "res-2",
        gearItemId: "item-2",
        mode: "SOFT_HOLD",
        status: "ACTIVE",
        approvalStatus: "NOT_REQUIRED",
        holdType: null,
        purpose: "TEAM",
        quantityRequested: 2,
        windowStartAt: new Date("2026-05-27T09:00:00Z"),
        windowEndAt: new Date("2026-05-27T13:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: "team-1",
        reservedForEventId: null,
        programId: null,
        conflictSummary: null,
      },
    ],
  });

  assert.ok(conflicts.some((conflict) => conflict.code === "OVERLAPPING_HOLD" && conflict.severity === "warning"));
  assert.ok(conflicts.some((conflict) => conflict.code === "CONSUMABLE_SHORTAGE" && conflict.severity === "blocking"));
});

test("out-of-service inventory condition blocks reservations", () => {
  const conflicts = evaluateGearReservationConflicts({
    lifecycleStatus: "ACTIVE",
    readinessState: "READY",
    inventoryCondition: "OUT_OF_SERVICE",
    inventoryType: "DURABLE",
    quantityOnHand: 1,
    currentOpenCheckoutCount: 0,
    currentAssignmentCount: 0,
    requestedMode: "HARD_RESERVATION",
    requestedHoldType: null,
    requestedQuantity: 1,
    requestedWindowStartAt: new Date("2026-05-27T10:00:00Z"),
    requestedWindowEndAt: new Date("2026-05-27T12:00:00Z"),
    approvalRequired: false,
    existingReservations: [],
  });

  assert.ok(conflicts.some((conflict) => conflict.code === "OUT_OF_SERVICE" && conflict.severity === "blocking"));
});

test("reservation summary counts current, upcoming, expired, and blocked reservations", () => {
  const summary = summarizeGearReservations(
    [
      {
        id: "active-hard",
        gearItemId: "item-1",
        mode: "HARD_RESERVATION",
        status: "ACTIVE",
        approvalStatus: "NOT_REQUIRED",
        holdType: "EVENT_HOLD",
        purpose: "EVENT",
        quantityRequested: 1,
        windowStartAt: new Date("2026-05-26T10:00:00Z"),
        windowEndAt: new Date("2026-05-26T18:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: null,
        reservedForEventId: "event-1",
        programId: null,
      },
      {
        id: "active-soft",
        gearItemId: "item-1",
        mode: "SOFT_HOLD",
        status: "ACTIVE",
        approvalStatus: "NOT_REQUIRED",
        holdType: null,
        purpose: "TEAM",
        quantityRequested: 1,
        windowStartAt: new Date("2026-05-26T11:00:00Z"),
        windowEndAt: new Date("2026-05-26T16:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: "team-1",
        reservedForEventId: null,
        programId: null,
      },
      {
        id: "future",
        gearItemId: "item-2",
        mode: "HARD_RESERVATION",
        status: "PENDING_REVIEW",
        approvalStatus: "PENDING",
        holdType: "MAINTENANCE_HOLD",
        purpose: "MAINTENANCE",
        quantityRequested: 1,
        windowStartAt: new Date("2026-05-27T10:00:00Z"),
        windowEndAt: new Date("2026-05-27T18:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: null,
        reservedForEventId: null,
        programId: null,
      },
      {
        id: "expired",
        gearItemId: "item-3",
        mode: "HARD_RESERVATION",
        status: "ACTIVE",
        approvalStatus: "NOT_REQUIRED",
        holdType: null,
        purpose: "OTHER",
        quantityRequested: 1,
        windowStartAt: new Date("2026-05-20T10:00:00Z"),
        windowEndAt: new Date("2026-05-20T18:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: null,
        reservedForEventId: null,
        programId: null,
      },
    ],
    now,
  );

  assert.equal(summary.currentReservedCount, 1);
  assert.equal(summary.currentHeldCount, 1);
  assert.equal(summary.upcomingCount, 1);
  assert.equal(summary.expiredCount, 1);
  assert.equal(summary.eventHeldCount, 1);
  assert.equal(summary.maintenanceHeldCount, 1);
  assert.equal(summary.blockedCount, 1);
});

test("matching reservation fulfillment prefers overlapping contextual reservations", () => {
  const reservation = findReservationToFulfill({
    when: new Date("2026-05-26T13:00:00Z"),
    eventId: "event-1",
    reservations: [
      {
        id: "res-a",
        gearItemId: "item-1",
        mode: "HARD_RESERVATION",
        status: "ACTIVE",
        approvalStatus: "NOT_REQUIRED",
        holdType: null,
        purpose: "EVENT",
        quantityRequested: 1,
        windowStartAt: new Date("2026-05-26T12:00:00Z"),
        windowEndAt: new Date("2026-05-26T14:00:00Z"),
        reservedForPersonId: null,
        reservedForTeamId: null,
        reservedForEventId: "event-1",
        programId: null,
      },
    ],
  });

  assert.equal(reservation?.id, "res-a");
});
