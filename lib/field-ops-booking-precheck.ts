import {
  ApprovalStatus,
  BookingStatus,
  ConflictSeverity,
  ConflictType,
  FacilityStatus,
  PrecheckStatus,
  ResourceStatus,
} from "@prisma/client";

type OverlappingBooking = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  approvalStatus: ApprovalStatus;
};

export type BookingConflictDraft = {
  conflictType: ConflictType;
  severity: ConflictSeverity;
  message: string;
  relatedBookingId?: string;
};

export function evaluateFieldOpsBookingPrecheck(input: {
  facilityStatus: FacilityStatus;
  resourceStatus: ResourceStatus;
  overlappingBookings: OverlappingBooking[];
}) {
  const conflicts: BookingConflictDraft[] = [];

  if (input.facilityStatus !== FacilityStatus.ACTIVE) {
    conflicts.push({
      conflictType: ConflictType.RESOURCE_UNAVAILABLE,
      severity: ConflictSeverity.BLOCKING,
      message: "Selected facility is not active and cannot accept booking requests.",
    });
  }

  if (input.resourceStatus !== ResourceStatus.ACTIVE) {
    conflicts.push({
      conflictType: ConflictType.RESOURCE_UNAVAILABLE,
      severity: ConflictSeverity.BLOCKING,
      message: "Selected resource is not active and cannot accept booking requests.",
    });
  }

  for (const overlappingBooking of input.overlappingBookings) {
    const isApprovedOverlap =
      overlappingBooking.status === BookingStatus.APPROVED ||
      overlappingBooking.approvalStatus === ApprovalStatus.APPROVED;

    conflicts.push({
      conflictType: ConflictType.RESOURCE_TIME_OVERLAP,
      severity: isApprovedOverlap ? ConflictSeverity.BLOCKING : ConflictSeverity.WARNING,
      message: isApprovedOverlap
        ? `Overlaps approved booking "${overlappingBooking.title}".`
        : `Overlaps pending/requested booking "${overlappingBooking.title}".`,
      relatedBookingId: overlappingBooking.id,
    });
  }

  const hasBlockingConflict = conflicts.some((conflict) => conflict.severity === ConflictSeverity.BLOCKING);
  const hasWarningConflict = conflicts.some((conflict) => conflict.severity === ConflictSeverity.WARNING);

  if (hasBlockingConflict) {
    return {
      conflicts,
      precheckStatus: PrecheckStatus.FAILED,
      status: BookingStatus.CONFLICT_FOUND,
    };
  }

  if (hasWarningConflict) {
    return {
      conflicts,
      precheckStatus: PrecheckStatus.WARNING,
      status: BookingStatus.REQUESTED,
    };
  }

  return {
    conflicts,
    precheckStatus: PrecheckStatus.PASSED,
    status: BookingStatus.PRECHECK_PASSED,
  };
}
