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

export const INTERNAL_NOTIFICATION_CANDIDATE_TYPE = {
  OVERDUE_FOLLOW_UP: "overdue_follow_up_candidate",
  UNRESOLVED_OPERATIONAL_CONCERN: "unresolved_operational_concern_candidate",
  ATTENDANCE_REVIEW: "attendance_review_candidate",
  READINESS_CONCERN: "readiness_concern_candidate",
  ASSIGNMENT_UPDATE_AWARENESS: "assignment_update_awareness_candidate",
} as const;

export type InternalNotificationCandidateType =
  (typeof INTERNAL_NOTIFICATION_CANDIDATE_TYPE)[keyof typeof INTERNAL_NOTIFICATION_CANDIDATE_TYPE];

const INTERNAL_NOTIFICATION_CANDIDATE_LABELS: Record<InternalNotificationCandidateType, string> = {
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.OVERDUE_FOLLOW_UP]: "overdue follow-up candidate",
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.UNRESOLVED_OPERATIONAL_CONCERN]: "unresolved operational concern candidate",
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ATTENDANCE_REVIEW]: "attendance review candidate",
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.READINESS_CONCERN]: "readiness concern candidate",
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ASSIGNMENT_UPDATE_AWARENESS]: "assignment/update awareness candidate",
};

export type InternalNotificationCandidateEvaluation = {
  isCandidate: boolean;
  candidateType: InternalNotificationCandidateType | null;
  candidateLabel: string | null;
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

export function getInternalNotificationCandidateEvaluation(
  candidateType: InternalNotificationCandidateType | null,
): InternalNotificationCandidateEvaluation {
  return {
    isCandidate: Boolean(candidateType),
    candidateType,
    candidateLabel: candidateType ? INTERNAL_NOTIFICATION_CANDIDATE_LABELS[candidateType] : null,
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

export function classifyCommunicationCategoryNotificationCandidate(
  category: InternalCommunicationEventCategory,
): InternalNotificationCandidateType | null {
  switch (category) {
    case INTERNAL_COMMUNICATION_EVENT_CATEGORY.FOLLOW_UP_REMINDER_CANDIDATE:
      return INTERNAL_NOTIFICATION_CANDIDATE_TYPE.OVERDUE_FOLLOW_UP;
    case INTERNAL_COMMUNICATION_EVENT_CATEGORY.ATTENDANCE_CONCERN:
      return INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ATTENDANCE_REVIEW;
    case INTERNAL_COMMUNICATION_EVENT_CATEGORY.READINESS_CONCERN:
      return INTERNAL_NOTIFICATION_CANDIDATE_TYPE.READINESS_CONCERN;
    case INTERNAL_COMMUNICATION_EVENT_CATEGORY.ASSIGNMENT_UPDATE_EVENT:
      return INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ASSIGNMENT_UPDATE_AWARENESS;
    default:
      return null;
  }
}

export function classifyFollowUpTaskNotificationCandidate(input: {
  status: TaskStatus;
  dueAt: Date | null;
  updatedAt: Date;
  now?: Date;
  staleAfterHours?: number;
}): InternalNotificationCandidateType | null {
  if (input.status === TaskStatus.DONE || input.status === TaskStatus.CANCELLED) {
    return null;
  }

  const now = input.now ?? new Date();
  const isOverdue = Boolean(input.dueAt && input.dueAt.getTime() < now.getTime());
  if (isOverdue) {
    return INTERNAL_NOTIFICATION_CANDIDATE_TYPE.OVERDUE_FOLLOW_UP;
  }

  const staleAfterHours = input.staleAfterHours ?? 24 * 7;
  const staleThresholdMs = staleAfterHours * 60 * 60 * 1000;
  const isStaleUnresolved = now.getTime() - input.updatedAt.getTime() >= staleThresholdMs;
  if (input.status === TaskStatus.BLOCKED || isStaleUnresolved) {
    return INTERNAL_NOTIFICATION_CANDIDATE_TYPE.UNRESOLVED_OPERATIONAL_CONCERN;
  }

  return null;
}
