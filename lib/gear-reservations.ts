import type {
  ApprovalStatus,
  GearHoldType,
  GearItemLifecycleStatus,
  GearReservationMode,
  GearReservationPurpose,
  GearReservationStatus,
  InventoryReadinessState,
} from "@prisma/client";

export type GearReservationSnapshot = {
  id: string;
  gearItemId: string;
  mode: GearReservationMode;
  status: GearReservationStatus;
  approvalStatus: ApprovalStatus;
  holdType: GearHoldType | null;
  purpose: GearReservationPurpose;
  quantityRequested: number;
  windowStartAt: Date;
  windowEndAt: Date;
  reservedForPersonId: string | null;
  reservedForTeamId: string | null;
  reservedForEventId: string | null;
  programId: string | null;
  conflictSummary?: string | null;
};

export type GearReservationConflictCode =
  | "OUT_OF_SERVICE"
  | "READINESS_WARNING"
  | "OPEN_CHECKOUT"
  | "ACTIVE_ASSIGNMENT"
  | "OVERLAPPING_RESERVATION"
  | "OVERLAPPING_HOLD"
  | "CONSUMABLE_SHORTAGE"
  | "APPROVAL_REQUIRED";

export type GearReservationConflict = {
  code: GearReservationConflictCode;
  severity: "warning" | "blocking";
  message: string;
};

export type GearReservationEvaluationInput = {
  lifecycleStatus: GearItemLifecycleStatus;
  readinessState: InventoryReadinessState | null;
  inventoryType: "DURABLE" | "CONSUMABLE";
  quantityOnHand: number;
  currentOpenCheckoutCount: number;
  currentAssignmentCount: number;
  requestedMode: GearReservationMode;
  requestedHoldType: GearHoldType | null;
  requestedQuantity: number;
  requestedWindowStartAt: Date;
  requestedWindowEndAt: Date;
  existingReservations: GearReservationSnapshot[];
  approvalRequired: boolean;
};

export type GearReservationSummary = {
  currentReservedCount: number;
  currentHeldCount: number;
  upcomingCount: number;
  expiredCount: number;
  conflictCount: number;
  eventHeldCount: number;
  maintenanceHeldCount: number;
  blockedCount: number;
};

const TERMINAL_STATUSES = new Set<GearReservationStatus>([
  "RELEASED",
  "CANCELED",
  "FULFILLED",
  "EXPIRED",
]);

const ACTIVE_STATUSES = new Set<GearReservationStatus>([
  "ACTIVE",
  "PENDING_REVIEW",
  "CONFLICT",
]);

export function formatGearReservationEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isTerminalReservationStatus(status: GearReservationStatus) {
  return TERMINAL_STATUSES.has(status);
}

export function deriveGearReservationEffectiveStatus(
  reservation: Pick<GearReservationSnapshot, "status" | "windowEndAt">,
  now = new Date(),
): GearReservationStatus {
  if (TERMINAL_STATUSES.has(reservation.status)) {
    return reservation.status;
  }

  if (reservation.windowEndAt.getTime() < now.getTime()) {
    return "EXPIRED";
  }

  return reservation.status;
}

export function windowsOverlap(
  leftStartAt: Date,
  leftEndAt: Date,
  rightStartAt: Date,
  rightEndAt: Date,
) {
  return leftStartAt.getTime() < rightEndAt.getTime() && rightStartAt.getTime() < leftEndAt.getTime();
}

export function isBlockingHoldType(holdType: GearHoldType | null) {
  return holdType === "MAINTENANCE_HOLD" || holdType === "INSPECTION_HOLD" || holdType === "STAGING_HOLD";
}

export function isBlockingReservation(
  reservation: Pick<GearReservationSnapshot, "mode" | "status" | "windowStartAt" | "windowEndAt" | "holdType" | "approvalStatus">,
  now = new Date(),
) {
  const effectiveStatus = deriveGearReservationEffectiveStatus(reservation, now);
  if (!ACTIVE_STATUSES.has(effectiveStatus)) {
    return false;
  }

  if (reservation.approvalStatus === "PENDING") {
    return true;
  }

  return reservation.mode === "HARD_RESERVATION" || isBlockingHoldType(reservation.holdType);
}

export function isSoftHoldReservation(
  reservation: Pick<GearReservationSnapshot, "mode" | "holdType" | "status" | "windowEndAt">,
  now = new Date(),
) {
  const effectiveStatus = deriveGearReservationEffectiveStatus(reservation, now);
  return ACTIVE_STATUSES.has(effectiveStatus) && reservation.mode === "SOFT_HOLD" && !isBlockingHoldType(reservation.holdType);
}

export function evaluateGearReservationConflicts(input: GearReservationEvaluationInput): GearReservationConflict[] {
  const conflicts: GearReservationConflict[] = [];

  if (["MAINTENANCE", "QUARANTINED", "RETIRED", "LOST"].includes(input.lifecycleStatus)) {
    conflicts.push({
      code: "OUT_OF_SERVICE",
      severity: "blocking",
      message: "This item is currently out of service and cannot be reserved or held for fulfillment.",
    });
  }

  if (input.readinessState === "NOT_READY" || input.readinessState === "DECOMMISSIONED") {
    conflicts.push({
      code: "OUT_OF_SERVICE",
      severity: "blocking",
      message: "This item is not ready for operational use during the requested window.",
    });
  } else if (input.readinessState === "MAINTENANCE_REQUIRED" || input.readinessState === "NEEDS_INSPECTION") {
    conflicts.push({
      code: "READINESS_WARNING",
      severity: input.requestedMode === "HARD_RESERVATION" ? "blocking" : "warning",
      message: "Readiness or inspection follow-up is still open for this item.",
    });
  }

  if (input.currentOpenCheckoutCount > 0) {
    conflicts.push({
      code: "OPEN_CHECKOUT",
      severity: "blocking",
      message: "The item is currently checked out, so future availability cannot be confirmed safely.",
    });
  }

  if (input.currentAssignmentCount > 0) {
    conflicts.push({
      code: "ACTIVE_ASSIGNMENT",
      severity: input.requestedMode === "HARD_RESERVATION" ? "blocking" : "warning",
      message: "The item already has an active assignment or event allocation.",
    });
  }

  for (const reservation of input.existingReservations) {
    const effectiveStatus = deriveGearReservationEffectiveStatus(reservation, input.requestedWindowStartAt);
    if (!ACTIVE_STATUSES.has(effectiveStatus)) {
      continue;
    }

    if (
      !windowsOverlap(
        reservation.windowStartAt,
        reservation.windowEndAt,
        input.requestedWindowStartAt,
        input.requestedWindowEndAt,
      )
    ) {
      continue;
    }

    if (isBlockingReservation(reservation, input.requestedWindowStartAt)) {
      conflicts.push({
        code: reservation.mode === "SOFT_HOLD" ? "OVERLAPPING_HOLD" : "OVERLAPPING_RESERVATION",
        severity: "blocking",
        message:
          reservation.conflictSummary?.trim() ||
          `Another ${reservation.mode === "SOFT_HOLD" ? "hold" : "reservation"} already overlaps the requested window.`,
      });
      continue;
    }

    if (isSoftHoldReservation(reservation, input.requestedWindowStartAt)) {
      conflicts.push({
        code: "OVERLAPPING_HOLD",
        severity: "warning",
        message: reservation.conflictSummary?.trim() || "Another soft hold overlaps the requested window.",
      });
    }
  }

  if (input.inventoryType === "CONSUMABLE") {
    const reservedQuantity = input.existingReservations
      .filter((reservation) => ACTIVE_STATUSES.has(deriveGearReservationEffectiveStatus(reservation, input.requestedWindowStartAt)))
      .filter((reservation) =>
        windowsOverlap(
          reservation.windowStartAt,
          reservation.windowEndAt,
          input.requestedWindowStartAt,
          input.requestedWindowEndAt,
        ),
      )
      .reduce((sum, reservation) => sum + reservation.quantityRequested, 0);

    if (reservedQuantity + input.requestedQuantity > input.quantityOnHand) {
      conflicts.push({
        code: "CONSUMABLE_SHORTAGE",
        severity: "blocking",
        message: "Requested quantity exceeds currently available on-hand stock for the selected window.",
      });
    }
  }

  if (input.approvalRequired && input.requestedMode === "HARD_RESERVATION") {
    conflicts.push({
      code: "APPROVAL_REQUIRED",
      severity: "blocking",
      message: "Guardian or admin approval is required before this reservation can be fulfilled.",
    });
  }

  return conflicts;
}

export function hasBlockingReservationConflict(conflicts: GearReservationConflict[]) {
  return conflicts.some((conflict) => conflict.severity === "blocking");
}

export function summarizeGearReservations(
  reservations: GearReservationSnapshot[],
  now = new Date(),
): GearReservationSummary {
  const summary: GearReservationSummary = {
    currentReservedCount: 0,
    currentHeldCount: 0,
    upcomingCount: 0,
    expiredCount: 0,
    conflictCount: 0,
    eventHeldCount: 0,
    maintenanceHeldCount: 0,
    blockedCount: 0,
  };

  for (const reservation of reservations) {
    const effectiveStatus = deriveGearReservationEffectiveStatus(reservation, now);

    if (effectiveStatus === "EXPIRED") {
      summary.expiredCount += 1;
      continue;
    }

    if (effectiveStatus === "CONFLICT") {
      summary.conflictCount += 1;
    }

    if (reservation.holdType === "EVENT_HOLD" || reservation.purpose === "EVENT") {
      summary.eventHeldCount += 1;
    }

    if (reservation.holdType === "MAINTENANCE_HOLD" || reservation.holdType === "INSPECTION_HOLD") {
      summary.maintenanceHeldCount += 1;
    }

    const startsInFuture = reservation.windowStartAt.getTime() > now.getTime();
    if (startsInFuture && ACTIVE_STATUSES.has(effectiveStatus)) {
      summary.upcomingCount += 1;
    }

    const activeNow =
      ACTIVE_STATUSES.has(effectiveStatus) &&
      reservation.windowStartAt.getTime() <= now.getTime() &&
      reservation.windowEndAt.getTime() >= now.getTime();

    if (!activeNow) {
      continue;
    }

    if (reservation.mode === "SOFT_HOLD") {
      summary.currentHeldCount += 1;
    } else {
      summary.currentReservedCount += 1;
    }

    if (isBlockingReservation(reservation, now)) {
      summary.blockedCount += 1;
    }
  }

  return summary;
}

export function findReservationToFulfill(input: {
  reservations: GearReservationSnapshot[];
  when?: Date;
  personId?: string | null;
  teamId?: string | null;
  eventId?: string | null;
  programId?: string | null;
}) {
  const when = input.when ?? new Date();

  return input.reservations.find((reservation) => {
    const effectiveStatus = deriveGearReservationEffectiveStatus(reservation, when);
    if (!ACTIVE_STATUSES.has(effectiveStatus)) {
      return false;
    }

    const inWindow = reservation.windowStartAt.getTime() <= when.getTime() && reservation.windowEndAt.getTime() >= when.getTime();
    if (!inWindow) {
      return false;
    }

    return Boolean(
      (input.personId && reservation.reservedForPersonId === input.personId) ||
        (input.teamId && reservation.reservedForTeamId === input.teamId) ||
        (input.eventId && reservation.reservedForEventId === input.eventId) ||
        (input.programId && reservation.programId === input.programId),
    );
  });
}
