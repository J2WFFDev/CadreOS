// Phase 12D — Internal Operational Awareness View
//
// Purpose:
//   Provide a lightweight, read-only, internal-only awareness view grouped by
//   notification-candidate type, derived from existing operational history
//   classification metadata (Phases 12B–12C).
//
// What this is NOT:
//   - Not an Inbox (no triage, no capture semantics, no action-queue).
//   - Not a Feed (no timeline, no subscription, no delivery stream).
//   - Not a notification delivery mechanism (no dispatch, no push/email/SMS channels).
//   - Not a reminder system.
//   - Not a messaging/chat runtime surface.
//   - Not guardian-facing.
//   - Not an escalation or automation trigger.
//
// Deferred behavior (unchanged from Phases 12A–12C):
//   - Inbox runtime behavior.
//   - Feed runtime behavior.
//   - Notification delivery channels (in-app dispatch, push, SMS, email).
//   - Messaging/chat runtime.
//   - Guardian-facing runtime communications.
//   - Workflow automation / escalation.

import {
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE,
  type InternalNotificationCandidateType,
} from "@/lib/communication-classification";
import { type OperationalHistoryItem } from "@/lib/operational-history";

export type AwarenessItem = {
  id: string;
  title: string;
  href: string;
  summary: string;
  changedAt: Date;
  actorLabel: string | null;
};

export type AwarenessCategory = {
  candidateType: InternalNotificationCandidateType;
  label: string;
  description: string;
  items: AwarenessItem[];
  internalOnly: true;
  deliveryDeferred: true;
  messagingDeferred: true;
  guardianCommunicationDeferred: true;
};

export type OperationalAwarenessView = {
  // Explicit metadata markers — this view is not a delivery mechanism
  internalOnly: true;
  deliveryDeferred: true;
  messagingDeferred: true;
  guardianCommunicationDeferred: true;
  isInbox: false;
  isFeed: false;
  hasDeliveryBehavior: false;
  categories: AwarenessCategory[];
  totalCandidateCount: number;
  generatedAt: Date;
};

const AWARENESS_CATEGORY_METADATA: Record<
  InternalNotificationCandidateType,
  { label: string; description: string }
> = {
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.OVERDUE_FOLLOW_UP]: {
    label: "Overdue follow-up awareness",
    description: "Follow-up tasks that are past their due date and remain unresolved.",
  },
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.UNRESOLVED_OPERATIONAL_CONCERN]: {
    label: "Unresolved operational concern awareness",
    description: "Operational items with unresolved follow-up concerns requiring staff review.",
  },
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ATTENDANCE_REVIEW]: {
    label: "Attendance review awareness",
    description: "Attendance records flagged for review based on status and event context.",
  },
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.READINESS_CONCERN]: {
    label: "Readiness concern awareness",
    description: "Items indicating a readiness concern that may affect upcoming operations.",
  },
  [INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ASSIGNMENT_UPDATE_AWARENESS]: {
    label: "Assignment/update awareness",
    description: "Recent roster, role, or assignment changes that may require staff awareness.",
  },
};

const AWARENESS_CATEGORY_ORDER: InternalNotificationCandidateType[] = [
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE.OVERDUE_FOLLOW_UP,
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE.UNRESOLVED_OPERATIONAL_CONCERN,
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ATTENDANCE_REVIEW,
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE.READINESS_CONCERN,
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ASSIGNMENT_UPDATE_AWARENESS,
];

/**
 * Build a read-only internal operational awareness view from existing
 * operational history items. Items are grouped by notification-candidate type.
 *
 * This is a pure in-memory transformation — no database queries are performed.
 * Organization scoping and authorization filtering must be applied upstream
 * before calling this function (in the caller's `getOperationalHistory` call).
 */
export function buildOperationalAwarenessView(
  items: OperationalHistoryItem[],
): OperationalAwarenessView {
  const grouped = new Map<InternalNotificationCandidateType, AwarenessItem[]>();

  for (const item of items) {
    const { isCandidate, candidateType } = item.notificationCandidateEvaluation;
    if (!isCandidate || !candidateType) {
      continue;
    }

    const awarenessItem: AwarenessItem = {
      id: item.id,
      title: item.title,
      href: item.href,
      summary: item.summary,
      changedAt: item.changedAt,
      actorLabel: item.actor.name ? `${item.actor.label}: ${item.actor.name}` : null,
    };

    const existing = grouped.get(candidateType) ?? [];
    existing.push(awarenessItem);
    grouped.set(candidateType, existing);
  }

  const categories: AwarenessCategory[] = AWARENESS_CATEGORY_ORDER.filter((type) =>
    grouped.has(type),
  ).map((type) => {
    const meta = AWARENESS_CATEGORY_METADATA[type];
    return {
      candidateType: type,
      label: meta.label,
      description: meta.description,
      items: grouped.get(type) ?? [],
      internalOnly: true,
      deliveryDeferred: true,
      messagingDeferred: true,
      guardianCommunicationDeferred: true,
    };
  });

  const totalCandidateCount = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return {
    internalOnly: true,
    deliveryDeferred: true,
    messagingDeferred: true,
    guardianCommunicationDeferred: true,
    isInbox: false,
    isFeed: false,
    hasDeliveryBehavior: false,
    categories,
    totalCandidateCount,
    generatedAt: new Date(),
  };
}
