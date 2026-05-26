import type { AwarenessEventType, EntryPriority, NotificationCategory, NotificationDeliveryTiming } from "@prisma/client";

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ASSIGNMENT: "Assignment",
  FOLLOW_UP: "Follow-up",
  READINESS: "Readiness",
  WORKFLOW: "Workflow",
  STATUS: "Status",
  LINKED_ISSUE: "Linked issue",
  ATTENDANCE: "Attendance",
};

export const NOTIFICATION_DELIVERY_TIMING_LABELS: Record<NotificationDeliveryTiming, string> = {
  IMMEDIATE: "Immediate in-app",
  DIGEST_ONLY: "Digest-first",
  OFF: "Muted",
};

export const AWARENESS_EVENT_LABELS: Record<AwarenessEventType, string> = {
  ENTRY_ASSIGNED: "Entry assigned",
  ASSIGNMENT_UPDATED: "Assignment updated",
  FOLLOW_UP_CREATED: "Follow-up created",
  READINESS_ISSUE_DETECTED: "Readiness issue detected",
  WORKFLOW_STEP_ATTENTION: "Workflow step requires attention",
  WORKFLOW_RUN_UPDATED: "Workflow updated",
  OPERATIONAL_STATUS_CHANGED: "Operational status changed",
  LINKED_OPERATIONAL_UPDATE: "Linked operational update",
  ATTENDANCE_REQUIRES_REVIEW: "Attendance requires review",
};

export const PRIORITY_ORDER: Record<EntryPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

export const LIVE_DUE_SOON_DAYS = 2;

export type NotificationPreferenceView = {
  minimumPriority: EntryPriority;
  deliveryTiming: NotificationDeliveryTiming;
  digestWindowHours: number;
  assignmentEnabled: boolean;
  followUpEnabled: boolean;
  readinessEnabled: boolean;
  workflowEnabled: boolean;
  statusEnabled: boolean;
  linkedIssueEnabled: boolean;
  attendanceEnabled: boolean;
  dueEnabled: boolean;
};

export type NotificationListItem = {
  id: string;
  category: NotificationCategory;
  categoryLabel: string;
  priority: EntryPriority;
  title: string;
  body: string;
  href: string;
  eventCount: number;
  firstEventAt: Date;
  lastEventAt: Date;
  readAt: Date | null;
  archivedAt: Date | null;
  deliveredAt: Date;
  actorLabel: string | null;
  awarenessEventLabel: string;
};

export type LiveDueAwarenessItem = {
  entryId: string;
  title: string;
  href: string;
  priority: EntryPriority;
  dueDate: Date;
  dueState: "OVERDUE" | "DUE_SOON";
  teamName: string | null;
};

export function labelForNotificationCategory(category: NotificationCategory) {
  return NOTIFICATION_CATEGORY_LABELS[category] ?? category;
}

export function labelForDeliveryTiming(deliveryTiming: NotificationDeliveryTiming) {
  return NOTIFICATION_DELIVERY_TIMING_LABELS[deliveryTiming] ?? deliveryTiming;
}

export function labelForAwarenessEventType(eventType: AwarenessEventType) {
  return AWARENESS_EVENT_LABELS[eventType] ?? eventType;
}

export function meetsNotificationPriorityThreshold(priority: EntryPriority, minimumPriority: EntryPriority) {
  return PRIORITY_ORDER[priority] >= PRIORITY_ORDER[minimumPriority];
}

export function maxNotificationPriority(left: EntryPriority, right: EntryPriority): EntryPriority {
  return PRIORITY_ORDER[left] >= PRIORITY_ORDER[right] ? left : right;
}

export function notificationPreferenceFieldForCategory(category: NotificationCategory): keyof NotificationPreferenceView {
  switch (category) {
    case "ASSIGNMENT":
      return "assignmentEnabled";
    case "FOLLOW_UP":
      return "followUpEnabled";
    case "READINESS":
      return "readinessEnabled";
    case "WORKFLOW":
      return "workflowEnabled";
    case "STATUS":
      return "statusEnabled";
    case "LINKED_ISSUE":
      return "linkedIssueEnabled";
    case "ATTENDANCE":
      return "attendanceEnabled";
  }
}

export function buildNotificationAggregateKey(input: {
  category: NotificationCategory;
  subjectId: string;
  secondaryId?: string | null;
}) {
  return [input.category.toLowerCase(), input.subjectId, input.secondaryId].filter(Boolean).join(":");
}

export function buildDigestWindow(now: Date, digestWindowHours: number) {
  const safeHours = Math.max(1, Math.min(168, Math.trunc(digestWindowHours) || 24));
  const windowMs = safeHours * 60 * 60 * 1000;
  const windowStartsAt = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const windowEndsAt = new Date(windowStartsAt.getTime() + windowMs);

  return { windowStartsAt, windowEndsAt, digestWindowHours: safeHours };
}

export function determineLiveDueState(dueDate: Date | null, now: Date, dueSoonDays = LIVE_DUE_SOON_DAYS) {
  if (!dueDate) return "NONE" as const;

  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dueDate.getTime() < todayStart.getTime()) {
    return "OVERDUE" as const;
  }

  const dueSoonLimit = new Date(todayStart.getTime() + (dueSoonDays + 1) * 24 * 60 * 60 * 1000);
  if (dueDate.getTime() < dueSoonLimit.getTime()) {
    return "DUE_SOON" as const;
  }

  return "NONE" as const;
}
