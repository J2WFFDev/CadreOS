import { AttendanceStatus, EntryRuntimeSourceModelType, TaskStatus } from "@prisma/client";

export const INTERNAL_COMMUNICATION_EVENT_CATEGORY = {
  OPERATIONAL_UPDATE: "operational_update",
  FOLLOW_UP_REMINDER_CANDIDATE: "follow_up_reminder_candidate",
  ATTENDANCE_CONCERN: "attendance_concern",
  READINESS_CONCERN: "readiness_concern",
  ASSIGNMENT_UPDATE_EVENT: "assignment_update_event",
  INFORMATIONAL_OPERATIONAL_EVENT: "informational_operational_event",
} as const;

export type InternalCommunicationEventCategory =
  (typeof INTERNAL_COMMUNICATION_EVENT_CATEGORY)[keyof typeof INTERNAL_COMMUNICATION_EVENT_CATEGORY];

const INTERNAL_COMMUNICATION_EVENT_CATEGORY_LABELS: Record<InternalCommunicationEventCategory, string> = {
  [INTERNAL_COMMUNICATION_EVENT_CATEGORY.OPERATIONAL_UPDATE]: "operational update",
  [INTERNAL_COMMUNICATION_EVENT_CATEGORY.FOLLOW_UP_REMINDER_CANDIDATE]: "follow-up reminder candidate",
  [INTERNAL_COMMUNICATION_EVENT_CATEGORY.ATTENDANCE_CONCERN]: "attendance concern",
  [INTERNAL_COMMUNICATION_EVENT_CATEGORY.READINESS_CONCERN]: "readiness concern",
  [INTERNAL_COMMUNICATION_EVENT_CATEGORY.ASSIGNMENT_UPDATE_EVENT]: "assignment/update event",
  [INTERNAL_COMMUNICATION_EVENT_CATEGORY.INFORMATIONAL_OPERATIONAL_EVENT]: "informational operational event",
};

export type InternalCommunicationEventClassification = {
  category: InternalCommunicationEventCategory;
  categoryLabel: string;
  internalOnly: true;
  deliveryDeferred: true;
  messagingDeferred: true;
  guardianCommunicationDeferred: true;
};

export function getInternalCommunicationEventClassification(
  category: InternalCommunicationEventCategory,
): InternalCommunicationEventClassification {
  return {
    category,
    categoryLabel: INTERNAL_COMMUNICATION_EVENT_CATEGORY_LABELS[category],
    internalOnly: true,
    deliveryDeferred: true,
    messagingDeferred: true,
    guardianCommunicationDeferred: true,
  };
}

export function classifyEntryRuntimeCommunicationCategory(
  sourceModelType: EntryRuntimeSourceModelType,
): InternalCommunicationEventCategory {
  if (sourceModelType === EntryRuntimeSourceModelType.FOLLOW_UP_TASK) {
    return INTERNAL_COMMUNICATION_EVENT_CATEGORY.FOLLOW_UP_REMINDER_CANDIDATE;
  }

  return INTERNAL_COMMUNICATION_EVENT_CATEGORY.OPERATIONAL_UPDATE;
}

export function classifyFollowUpTaskCommunicationCategory(input: {
  status: TaskStatus;
  dueAt: Date | null;
  now?: Date;
}): InternalCommunicationEventCategory {
  if (input.status === TaskStatus.DONE || input.status === TaskStatus.CANCELLED) {
    return INTERNAL_COMMUNICATION_EVENT_CATEGORY.INFORMATIONAL_OPERATIONAL_EVENT;
  }

  const now = input.now ?? new Date();
  const isOverdue = Boolean(input.dueAt && input.dueAt.getTime() < now.getTime());
  if (isOverdue || input.status === TaskStatus.BLOCKED) {
    return INTERNAL_COMMUNICATION_EVENT_CATEGORY.FOLLOW_UP_REMINDER_CANDIDATE;
  }

  return INTERNAL_COMMUNICATION_EVENT_CATEGORY.OPERATIONAL_UPDATE;
}

export function classifyAttendanceCommunicationCategory(status: AttendanceStatus): InternalCommunicationEventCategory {
  if (status === AttendanceStatus.PRESENT) {
    return INTERNAL_COMMUNICATION_EVENT_CATEGORY.INFORMATIONAL_OPERATIONAL_EVENT;
  }

  return INTERNAL_COMMUNICATION_EVENT_CATEGORY.ATTENDANCE_CONCERN;
}
