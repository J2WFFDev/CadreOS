import {
  GearConditionStatus,
  GearReservationStatus,
  type GearReservationWorkflowStatus,
} from "@prisma/client";

export function deriveReservationWorkflowStatus(
  status: GearReservationStatus,
): GearReservationWorkflowStatus {
  switch (status) {
    case "DRAFT":
      return "REQUESTED";
    case "PENDING_REVIEW":
      return "PENDING_APPROVAL";
    case "ACTIVE":
      return "APPROVED";
    case "CONFLICT":
      return "DENIED";
    case "RELEASED":
    case "FULFILLED":
    case "EXPIRED":
      return "CLOSED";
    case "CANCELED":
      return "CANCELLED";
    default:
      return "REQUESTED";
  }
}

export function deriveReturnWorkflowStatus(input: {
  conditionOnReturn: GearConditionStatus | null;
}): GearReservationWorkflowStatus {
  if (isInspectionIssueCondition(input.conditionOnReturn)) {
    return "INSPECTION_NEEDED";
  }
  return "RETURNED";
}

export function isInspectionIssueCondition(condition: GearConditionStatus | null) {
  return condition === "DAMAGED" || condition === "POOR";
}
