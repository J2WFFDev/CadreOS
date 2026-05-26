import {
  AwarenessEventType,
  EntryStatus,
  RoleType,
  ScopeType,
  type EntryPriority,
  type NotificationDeliveryTiming,
  type NotificationPreference,
  type Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import { ACTIVE_OPERATIONAL_TYPES } from "@/lib/operational-feed/types";
import {
  type LiveDueAwarenessItem,
  type NotificationListItem,
  type NotificationPreferenceView,
  buildDigestWindow,
  buildNotificationAggregateKey,
  determineLiveDueState,
  labelForAwarenessEventType,
  labelForNotificationCategory,
  maxNotificationPriority,
  meetsNotificationPriorityThreshold,
  notificationPreferenceFieldForCategory,
} from "./types";

const STAFF_NOTIFICATION_ROLES: RoleType[] = [
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceView = {
  minimumPriority: "LOW",
  deliveryTiming: "IMMEDIATE",
  digestWindowHours: 24,
  assignmentEnabled: true,
  followUpEnabled: true,
  readinessEnabled: true,
  workflowEnabled: true,
  statusEnabled: true,
  linkedIssueEnabled: true,
  attendanceEnabled: true,
  dueEnabled: true,
};

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dedupe(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isActiveNotificationEntryStatus(status: EntryStatus) {
  return status === EntryStatus.OPEN || status === EntryStatus.IN_PROGRESS;
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metadata ? JSON.stringify(metadata) : null;
}

function parseNotificationIdsJson(notificationIdsJson: string | null) {
  if (!notificationIdsJson) return [] as string[];

  try {
    const parsed = JSON.parse(notificationIdsJson);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function toPreferenceView(preference: NotificationPreference | null | undefined): NotificationPreferenceView {
  if (!preference) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    minimumPriority: preference.minimumPriority,
    deliveryTiming: preference.deliveryTiming,
    digestWindowHours: preference.digestWindowHours,
    assignmentEnabled: preference.assignmentEnabled,
    followUpEnabled: preference.followUpEnabled,
    readinessEnabled: preference.readinessEnabled,
    workflowEnabled: preference.workflowEnabled,
    statusEnabled: preference.statusEnabled,
    linkedIssueEnabled: preference.linkedIssueEnabled,
    attendanceEnabled: preference.attendanceEnabled,
    dueEnabled: preference.dueEnabled,
  };
}

function isCategoryEnabled(preference: NotificationPreferenceView, category: NotificationListItem["category"]) {
  return preference[notificationPreferenceFieldForCategory(category)] === true;
}

async function resolveEligibleRecipientIds(organizationId: string, candidateIds: string[]) {
  if (candidateIds.length === 0) return [] as string[];

  const people = await db.person.findMany({
    where: {
      organizationId,
      id: { in: candidateIds },
      lifecycleStatus: { not: "ARCHIVED" },
    },
    select: { id: true },
  });

  return people.map((person) => person.id);
}

async function resolveScopedStaffRecipientIds(input: {
  organizationId: string;
  programId?: string | null;
  teamId?: string | null;
}) {
  const scopeClauses: Prisma.RoleAssignmentWhereInput[] = [{ scopeType: ScopeType.ORGANIZATION }];

  if (input.programId) {
    scopeClauses.push({ scopeType: ScopeType.PROGRAM, programId: input.programId });
  }

  if (input.teamId) {
    scopeClauses.push({ scopeType: ScopeType.TEAM, teamId: input.teamId });
  }

  const roleAssignments = await db.roleAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      roleType: { in: STAFF_NOTIFICATION_ROLES },
      OR: scopeClauses,
    },
    select: { personId: true },
  });

  return dedupe(roleAssignments.map((assignment) => assignment.personId));
}

async function queueDigestPlaceholder(input: {
  organizationId: string;
  personId: string;
  notificationId: string;
  digestWindowHours: number;
  deliveryTiming: NotificationDeliveryTiming;
  now: Date;
}) {
  const { windowStartsAt, windowEndsAt } = buildDigestWindow(input.now, input.digestWindowHours);
  const existing = await db.notificationDigest.findUnique({
    where: {
      organizationId_personId_deliveryTiming_windowStartsAt_windowEndsAt: {
        organizationId: input.organizationId,
        personId: input.personId,
        deliveryTiming: input.deliveryTiming,
        windowStartsAt,
        windowEndsAt,
      },
    },
    select: {
      id: true,
      notificationIdsJson: true,
    },
  });

  const notificationIds = dedupe([
    ...(existing ? parseNotificationIdsJson(existing.notificationIdsJson) : []),
    input.notificationId,
  ]);

  if (!existing) {
    await db.notificationDigest.create({
      data: {
        organizationId: input.organizationId,
        personId: input.personId,
        status: "PENDING",
        deliveryTiming: input.deliveryTiming,
        windowStartsAt,
        windowEndsAt,
        notificationIdsJson: JSON.stringify(notificationIds),
      },
    });
    return;
  }

  await db.notificationDigest.update({
    where: { id: existing.id },
    data: {
      notificationIdsJson: JSON.stringify(notificationIds),
      status: "PENDING",
      updatedAt: input.now,
    },
  });
}

type PersistAwarenessInput = {
  organizationId: string;
  eventType: AwarenessEventType;
  category: NotificationListItem["category"];
  priority: EntryPriority;
  aggregateKey: string;
  title: string;
  body: string;
  href: string;
  actorPersonId?: string | null;
  entryId?: string | null;
  workflowRunId?: string | null;
  eventId?: string | null;
  teamId?: string | null;
  metadata?: Record<string, unknown> | null;
  recipientIds: string[];
  occurredAt?: Date;
};

async function persistAwarenessNotification(input: PersistAwarenessInput) {
  const occurredAt = input.occurredAt ?? new Date();
  const eligibleRecipientIds = await resolveEligibleRecipientIds(input.organizationId, input.recipientIds);
  if (eligibleRecipientIds.length === 0) return null;

  const preferences = await db.notificationPreference.findMany({
    where: {
      organizationId: input.organizationId,
      personId: { in: eligibleRecipientIds },
    },
  });
  const preferenceByPersonId = new Map(preferences.map((preference) => [preference.personId, toPreferenceView(preference)]));
  const filteredRecipientIds = eligibleRecipientIds.filter((personId) => {
    const preference = preferenceByPersonId.get(personId) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    return isCategoryEnabled(preference, input.category) && meetsNotificationPriorityThreshold(input.priority, preference.minimumPriority);
  });

  if (filteredRecipientIds.length === 0) return null;

  const awarenessEvent = await db.awarenessEvent.create({
    data: {
      organizationId: input.organizationId,
      eventType: input.eventType,
      category: input.category,
      priority: input.priority,
      aggregateKey: input.aggregateKey,
      title: input.title,
      body: input.body,
      href: input.href,
      entryId: input.entryId ?? null,
      workflowRunId: input.workflowRunId ?? null,
      eventId: input.eventId ?? null,
      teamId: input.teamId ?? null,
      actorPersonId: input.actorPersonId ?? null,
      metadataJson: serializeMetadata(input.metadata),
      occurredAt,
      createdAt: occurredAt,
    },
    select: { id: true },
  });

  const existingNotification = await db.notification.findUnique({
    where: {
      organizationId_aggregateKey: {
        organizationId: input.organizationId,
        aggregateKey: input.aggregateKey,
      },
    },
    select: {
      id: true,
      priority: true,
    },
  });

  const notification = existingNotification
    ? await db.notification.update({
        where: { id: existingNotification.id },
        data: {
          latestAwarenessEventId: awarenessEvent.id,
          category: input.category,
          priority: maxNotificationPriority(existingNotification.priority, input.priority),
          entryId: input.entryId ?? null,
          workflowRunId: input.workflowRunId ?? null,
          teamId: input.teamId ?? null,
          title: input.title,
          body: input.body,
          href: input.href,
          eventCount: { increment: 1 },
          lastEventAt: occurredAt,
        },
        select: { id: true },
      })
    : await db.notification.create({
        data: {
          organizationId: input.organizationId,
          aggregateKey: input.aggregateKey,
          category: input.category,
          priority: input.priority,
          latestAwarenessEventId: awarenessEvent.id,
          entryId: input.entryId ?? null,
          workflowRunId: input.workflowRunId ?? null,
          teamId: input.teamId ?? null,
          title: input.title,
          body: input.body,
          href: input.href,
          eventCount: 1,
          firstEventAt: occurredAt,
          lastEventAt: occurredAt,
        },
        select: { id: true },
      });

  await Promise.all(
    filteredRecipientIds.map((personId) =>
      db.notificationReadState.upsert({
        where: {
          notificationId_personId: {
            notificationId: notification.id,
            personId,
          },
        },
        create: {
          organizationId: input.organizationId,
          notificationId: notification.id,
          personId,
          deliveredAt: occurredAt,
        },
        update: {
          readAt: null,
          archivedAt: null,
          deliveredAt: occurredAt,
        },
      }),
    ),
  );

  await Promise.all(
    filteredRecipientIds.map(async (personId) => {
      const preference = preferenceByPersonId.get(personId) ?? DEFAULT_NOTIFICATION_PREFERENCES;
      if (preference.deliveryTiming !== "DIGEST_ONLY") return;

      await queueDigestPlaceholder({
        organizationId: input.organizationId,
        personId,
        notificationId: notification.id,
        digestWindowHours: preference.digestWindowHours,
        deliveryTiming: preference.deliveryTiming,
        now: occurredAt,
      });
    }),
  );

  return notification;
}

async function loadEntryAwarenessContext(organizationId: string, entryId: string) {
  return db.entry.findFirst({
    where: { id: entryId, organizationId, deletedAt: null },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      priority: true,
      assignedToPersonId: true,
      createdByPersonId: true,
      dueDate: true,
      teamId: true,
      objectLinks: {
        select: { id: true },
        take: 1,
      },
      linkedFrom: {
        select: { id: true },
        take: 1,
      },
      linkedTo: {
        select: { id: true },
        take: 1,
      },
      assignments: {
        where: { revokedAt: null },
        select: { personId: true },
      },
      team: {
        select: {
          id: true,
          name: true,
          programId: true,
        },
      },
    },
  });
}

function resolveEntryAudience(input: {
  actorPersonId: string | null | undefined;
  assignedToPersonId: string | null;
  assignmentPersonIds: string[];
  createdByPersonId: string;
  scopedStaffRecipientIds?: string[];
  directRecipientIds?: string[];
}) {
  return dedupe([
    ...(input.directRecipientIds ?? []),
    input.assignedToPersonId,
    ...input.assignmentPersonIds,
    input.createdByPersonId,
    ...(input.scopedStaffRecipientIds ?? []),
  ]).filter((personId) => personId !== input.actorPersonId);
}

export async function emitEntryActivityAwareness(input: {
  organizationId: string;
  entryId: string;
  actorPersonId: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}) {
  const entry = await loadEntryAwarenessContext(input.organizationId, input.entryId);
  if (!entry) return null;

  const scopedStaffRecipientIds = entry.teamId
    ? await resolveScopedStaffRecipientIds({
        organizationId: input.organizationId,
        programId: entry.team?.programId ?? null,
        teamId: entry.teamId,
      })
    : [];
  const assignmentPersonIds = entry.assignments.map((assignment) => assignment.personId);
  const metadataPersonId = typeof input.metadata?.personId === "string" ? input.metadata.personId : null;
  const metadataWorkflowRunId = typeof input.metadata?.workflowRunId === "string" ? input.metadata.workflowRunId : null;

  if (input.action === "entry.assignment_added" || input.action === "entry.assignment_revoked") {
    return persistAwarenessNotification({
      organizationId: input.organizationId,
      eventType: input.action === "entry.assignment_added" ? AwarenessEventType.ENTRY_ASSIGNED : AwarenessEventType.ASSIGNMENT_UPDATED,
      category: "ASSIGNMENT",
      priority: entry.priority,
      aggregateKey: buildNotificationAggregateKey({ category: "ASSIGNMENT", subjectId: entry.id }),
      title: "Assignment updated",
      body: `${entry.title} assignment ownership changed.`,
      href: `/entries/${entry.id}`,
      actorPersonId: input.actorPersonId,
      entryId: entry.id,
      teamId: entry.teamId,
      metadata: input.metadata ?? null,
      recipientIds: resolveEntryAudience({
        actorPersonId: input.actorPersonId,
        assignedToPersonId: entry.assignedToPersonId,
        assignmentPersonIds,
        createdByPersonId: entry.createdByPersonId,
        directRecipientIds: metadataPersonId ? [metadataPersonId] : [],
      }),
      occurredAt: input.occurredAt,
    });
  }

  if (input.action === "entry.created") {
    if (entry.type === "READINESS_ITEM" && isActiveNotificationEntryStatus(entry.status)) {
      return persistAwarenessNotification({
        organizationId: input.organizationId,
        eventType: AwarenessEventType.READINESS_ISSUE_DETECTED,
        category: "READINESS",
        priority: entry.priority,
        aggregateKey: buildNotificationAggregateKey({ category: "READINESS", subjectId: entry.id }),
        title: "Readiness issue detected",
        body: `${entry.title} needs operational review.`,
        href: `/entries/${entry.id}`,
        actorPersonId: input.actorPersonId,
        entryId: entry.id,
        teamId: entry.teamId,
        metadata: input.metadata ?? null,
        recipientIds: resolveEntryAudience({
          actorPersonId: input.actorPersonId,
          assignedToPersonId: entry.assignedToPersonId,
          assignmentPersonIds,
          createdByPersonId: entry.createdByPersonId,
          scopedStaffRecipientIds,
        }),
        occurredAt: input.occurredAt,
      });
    }

    if ((entry.type === "FOLLOW_UP" || entry.type === "TASK") && (entry.assignedToPersonId || assignmentPersonIds.length > 0)) {
      return persistAwarenessNotification({
        organizationId: input.organizationId,
        eventType: AwarenessEventType.FOLLOW_UP_CREATED,
        category: "FOLLOW_UP",
        priority: entry.priority,
        aggregateKey: buildNotificationAggregateKey({ category: "FOLLOW_UP", subjectId: entry.id }),
        title: "Follow-up created",
        body: `${entry.title} was created and routed for follow-through.`,
        href: `/entries/${entry.id}`,
        actorPersonId: input.actorPersonId,
        entryId: entry.id,
        teamId: entry.teamId,
        metadata: input.metadata ?? null,
        recipientIds: resolveEntryAudience({
          actorPersonId: input.actorPersonId,
          assignedToPersonId: entry.assignedToPersonId,
          assignmentPersonIds,
          createdByPersonId: entry.createdByPersonId,
        }),
        occurredAt: input.occurredAt,
      });
    }
  }

  if (
    input.action === "workflow.run_started" ||
    input.action === "workflow.step_completed" ||
    input.action === "workflow.run_completed" ||
    input.action === "workflow.run_cancelled" ||
    input.action === "workflow.chain_created"
  ) {
    return persistAwarenessNotification({
      organizationId: input.organizationId,
      eventType:
        input.action === "workflow.run_started" ? AwarenessEventType.WORKFLOW_STEP_ATTENTION : AwarenessEventType.WORKFLOW_RUN_UPDATED,
      category: "WORKFLOW",
      priority: entry.priority,
      aggregateKey: buildNotificationAggregateKey({
        category: "WORKFLOW",
        subjectId: metadataWorkflowRunId ?? entry.id,
      }),
      title: input.action === "workflow.run_started" ? "Workflow step requires attention" : "Workflow updated",
      body:
        input.action === "workflow.run_started"
          ? `${entry.title} is the active workflow step requiring follow-through.`
          : `${entry.title} workflow progress changed.`,
      href: `/entries/${entry.id}`,
      actorPersonId: input.actorPersonId,
      entryId: entry.id,
      workflowRunId: metadataWorkflowRunId,
      teamId: entry.teamId,
      metadata: input.metadata ?? null,
      recipientIds: resolveEntryAudience({
        actorPersonId: input.actorPersonId,
        assignedToPersonId: entry.assignedToPersonId,
        assignmentPersonIds,
        createdByPersonId: entry.createdByPersonId,
        scopedStaffRecipientIds: input.action === "workflow.run_started" ? scopedStaffRecipientIds : [],
      }),
      occurredAt: input.occurredAt,
    });
  }

  if (input.action === "entry.object_link_added" || input.action === "entry.object_link_removed" || input.action === "entry.graph_link_added" || input.action === "entry.graph_link_removed") {
    return persistAwarenessNotification({
      organizationId: input.organizationId,
      eventType: AwarenessEventType.LINKED_OPERATIONAL_UPDATE,
      category: "LINKED_ISSUE",
      priority: entry.priority,
      aggregateKey: buildNotificationAggregateKey({ category: "LINKED_ISSUE", subjectId: entry.id }),
      title: "Linked operational issue updated",
      body: `${entry.title} linkage context changed.`,
      href: `/entries/${entry.id}`,
      actorPersonId: input.actorPersonId,
      entryId: entry.id,
      teamId: entry.teamId,
      metadata: input.metadata ?? null,
      recipientIds: resolveEntryAudience({
        actorPersonId: input.actorPersonId,
        assignedToPersonId: entry.assignedToPersonId,
        assignmentPersonIds,
        createdByPersonId: entry.createdByPersonId,
        scopedStaffRecipientIds,
      }),
      occurredAt: input.occurredAt,
    });
  }

  if (input.action === "entry.status_changed" || input.action === "entry.task_completed" || input.action === "entry.completed") {
    if (entry.type === "READINESS_ITEM" && isActiveNotificationEntryStatus(entry.status)) {
      return persistAwarenessNotification({
        organizationId: input.organizationId,
        eventType: AwarenessEventType.READINESS_ISSUE_DETECTED,
        category: "READINESS",
        priority: entry.priority,
        aggregateKey: buildNotificationAggregateKey({ category: "READINESS", subjectId: entry.id }),
        title: "Readiness issue detected",
        body: `${entry.title} remains in an active readiness state requiring awareness.`,
        href: `/entries/${entry.id}`,
        actorPersonId: input.actorPersonId,
        entryId: entry.id,
        teamId: entry.teamId,
        metadata: input.metadata ?? null,
        recipientIds: resolveEntryAudience({
          actorPersonId: input.actorPersonId,
          assignedToPersonId: entry.assignedToPersonId,
          assignmentPersonIds,
          createdByPersonId: entry.createdByPersonId,
          scopedStaffRecipientIds,
        }),
        occurredAt: input.occurredAt,
      });
    }

    return persistAwarenessNotification({
      organizationId: input.organizationId,
      eventType: AwarenessEventType.OPERATIONAL_STATUS_CHANGED,
      category: entry.objectLinks.length > 0 || entry.linkedFrom.length > 0 || entry.linkedTo.length > 0 ? "LINKED_ISSUE" : "STATUS",
      priority: entry.priority,
      aggregateKey: buildNotificationAggregateKey({
        category: entry.objectLinks.length > 0 || entry.linkedFrom.length > 0 || entry.linkedTo.length > 0 ? "LINKED_ISSUE" : "STATUS",
        subjectId: entry.id,
      }),
      title: entry.objectLinks.length > 0 || entry.linkedFrom.length > 0 || entry.linkedTo.length > 0 ? "Linked operational issue updated" : "Operational status changed",
      body: `${entry.title} status changed to ${formatEnumLabel(entry.status)}.`,
      href: `/entries/${entry.id}`,
      actorPersonId: input.actorPersonId,
      entryId: entry.id,
      teamId: entry.teamId,
      metadata: input.metadata ?? null,
      recipientIds: resolveEntryAudience({
        actorPersonId: input.actorPersonId,
        assignedToPersonId: entry.assignedToPersonId,
        assignmentPersonIds,
        createdByPersonId: entry.createdByPersonId,
      }),
      occurredAt: input.occurredAt,
    });
  }

  return null;
}

export async function emitAttendanceAwareness(input: {
  organizationId: string;
  eventId: string;
  actorPersonId: string | null;
  personId: string;
  attendanceStatus: string;
}) {
  if (input.attendanceStatus === "PRESENT") return null;

  const [event, person] = await Promise.all([
    db.event.findFirst({
      where: { id: input.eventId, organizationId: input.organizationId },
      select: {
        id: true,
        title: true,
        teamId: true,
        programId: true,
        createdByPersonId: true,
      },
    }),
    db.person.findFirst({
      where: { id: input.personId, organizationId: input.organizationId },
      select: { firstName: true, lastName: true },
    }),
  ]);

  if (!event) return null;

  const scopedStaffRecipientIds = await resolveScopedStaffRecipientIds({
    organizationId: input.organizationId,
    programId: event.programId,
    teamId: event.teamId,
  });
  const personLabel = person ? `${person.firstName} ${person.lastName}`.trim() : "Participant";

  return persistAwarenessNotification({
    organizationId: input.organizationId,
    eventType: AwarenessEventType.ATTENDANCE_REQUIRES_REVIEW,
    category: "ATTENDANCE",
    priority: input.attendanceStatus === "UNEXCUSED_ABSENT" ? "HIGH" : "MEDIUM",
    aggregateKey: buildNotificationAggregateKey({ category: "ATTENDANCE", subjectId: event.id, secondaryId: input.personId }),
    title: "Attendance requires review",
    body: `${personLabel} was marked ${formatEnumLabel(input.attendanceStatus)} for ${event.title}.`,
    href: `/events/${event.id}`,
    actorPersonId: input.actorPersonId,
    eventId: event.id,
    teamId: event.teamId,
    metadata: { personId: input.personId, attendanceStatus: input.attendanceStatus },
    recipientIds: dedupe([event.createdByPersonId, ...scopedStaffRecipientIds]).filter((personId) => personId !== input.actorPersonId),
  });
}

export async function emitEventStatusAwareness(input: {
  organizationId: string;
  eventId: string;
  actorPersonId: string | null;
  fromStatus: string | null;
  toStatus: string;
}) {
  if (input.fromStatus === input.toStatus) return null;

  const event = await db.event.findFirst({
    where: { id: input.eventId, organizationId: input.organizationId },
    select: {
      id: true,
      title: true,
      teamId: true,
      programId: true,
      createdByPersonId: true,
    },
  });

  if (!event) return null;

  const scopedStaffRecipientIds = await resolveScopedStaffRecipientIds({
    organizationId: input.organizationId,
    programId: event.programId,
    teamId: event.teamId,
  });

  return persistAwarenessNotification({
    organizationId: input.organizationId,
    eventType: AwarenessEventType.OPERATIONAL_STATUS_CHANGED,
    category: "STATUS",
    priority: input.toStatus === "ARCHIVED" ? "LOW" : "MEDIUM",
    aggregateKey: buildNotificationAggregateKey({ category: "STATUS", subjectId: event.id }),
    title: "Operational status changed",
    body: `${event.title} moved to ${formatEnumLabel(input.toStatus)}.`,
    href: `/events/${event.id}`,
    actorPersonId: input.actorPersonId,
    eventId: event.id,
    teamId: event.teamId,
    metadata: { fromStatus: input.fromStatus, toStatus: input.toStatus },
    recipientIds: dedupe([event.createdByPersonId, ...scopedStaffRecipientIds]).filter((personId) => personId !== input.actorPersonId),
  });
}

export async function listNotificationsForPerson(input: {
  organizationId: string;
  personId: string;
  includeRead?: boolean;
  limit?: number;
}): Promise<NotificationListItem[]> {
  const rows = await db.notificationReadState.findMany({
    where: {
      organizationId: input.organizationId,
      personId: input.personId,
      archivedAt: null,
      ...(input.includeRead ? {} : { readAt: null }),
    },
    orderBy: [{ readAt: "asc" }, { deliveredAt: "desc" }],
    take: input.limit ?? 50,
    select: {
      id: true,
      readAt: true,
      archivedAt: true,
      deliveredAt: true,
      notification: {
        select: {
          id: true,
          category: true,
          priority: true,
          title: true,
          body: true,
          href: true,
          eventCount: true,
          firstEventAt: true,
          lastEventAt: true,
          latestAwarenessEvent: {
            select: {
              eventType: true,
              actor: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.notification.id,
    category: row.notification.category,
    categoryLabel: labelForNotificationCategory(row.notification.category),
    priority: row.notification.priority,
    title: row.notification.title,
    body: row.notification.body,
    href: row.notification.href,
    eventCount: row.notification.eventCount,
    firstEventAt: row.notification.firstEventAt,
    lastEventAt: row.notification.lastEventAt,
    readAt: row.readAt,
    archivedAt: row.archivedAt,
    deliveredAt: row.deliveredAt,
    actorLabel: row.notification.latestAwarenessEvent.actor
      ? `${row.notification.latestAwarenessEvent.actor.firstName} ${row.notification.latestAwarenessEvent.actor.lastName}`.trim()
      : null,
    awarenessEventLabel: labelForAwarenessEventType(row.notification.latestAwarenessEvent.eventType),
  }));
}

export async function countUnreadNotificationsForPerson(organizationId: string, personId: string) {
  return db.notificationReadState.count({
    where: {
      organizationId,
      personId,
      readAt: null,
      archivedAt: null,
    },
  });
}

export async function setNotificationReadState(input: {
  organizationId: string;
  personId: string;
  notificationId: string;
  read: boolean;
}) {
  const existing = await db.notificationReadState.findFirst({
    where: {
      organizationId: input.organizationId,
      personId: input.personId,
      notificationId: input.notificationId,
    },
    select: { id: true },
  });

  if (!existing) return null;

  return db.notificationReadState.update({
    where: { id: existing.id },
    data: { readAt: input.read ? new Date() : null },
    select: { id: true, readAt: true },
  });
}

export async function markAllNotificationsRead(organizationId: string, personId: string) {
  const now = new Date();
  return db.notificationReadState.updateMany({
    where: {
      organizationId,
      personId,
      readAt: null,
      archivedAt: null,
    },
    data: { readAt: now },
  });
}

export async function getNotificationPreferences(organizationId: string, personId: string): Promise<NotificationPreferenceView> {
  const preference = await db.notificationPreference.findUnique({
    where: {
      organizationId_personId: {
        organizationId,
        personId,
      },
    },
  });

  return toPreferenceView(preference);
}

export async function updateNotificationPreferences(input: {
  organizationId: string;
  personId: string;
  values: NotificationPreferenceView;
}) {
  return db.notificationPreference.upsert({
    where: {
      organizationId_personId: {
        organizationId: input.organizationId,
        personId: input.personId,
      },
    },
    create: {
      organizationId: input.organizationId,
      personId: input.personId,
      minimumPriority: input.values.minimumPriority,
      deliveryTiming: input.values.deliveryTiming,
      digestWindowHours: input.values.digestWindowHours,
      assignmentEnabled: input.values.assignmentEnabled,
      followUpEnabled: input.values.followUpEnabled,
      readinessEnabled: input.values.readinessEnabled,
      workflowEnabled: input.values.workflowEnabled,
      statusEnabled: input.values.statusEnabled,
      linkedIssueEnabled: input.values.linkedIssueEnabled,
      attendanceEnabled: input.values.attendanceEnabled,
      dueEnabled: input.values.dueEnabled,
    },
    update: {
      minimumPriority: input.values.minimumPriority,
      deliveryTiming: input.values.deliveryTiming,
      digestWindowHours: input.values.digestWindowHours,
      assignmentEnabled: input.values.assignmentEnabled,
      followUpEnabled: input.values.followUpEnabled,
      readinessEnabled: input.values.readinessEnabled,
      workflowEnabled: input.values.workflowEnabled,
      statusEnabled: input.values.statusEnabled,
      linkedIssueEnabled: input.values.linkedIssueEnabled,
      attendanceEnabled: input.values.attendanceEnabled,
      dueEnabled: input.values.dueEnabled,
    },
  });
}

export async function listLiveDueAwareness(input: {
  organizationId: string;
  personId: string;
  now?: Date;
  limit?: number;
}): Promise<LiveDueAwarenessItem[]> {
  const now = input.now ?? new Date();
  const dueSoonBoundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3));

  const entries = await db.entry.findMany({
    where: {
      organizationId: input.organizationId,
      type: { in: [...ACTIVE_OPERATIONAL_TYPES] },
      deletedAt: null,
      status: { in: [EntryStatus.OPEN, EntryStatus.IN_PROGRESS] },
      dueDate: { lt: dueSoonBoundary },
      OR: [
        { assignedToPersonId: input.personId },
        {
          assignments: {
            some: {
              personId: input.personId,
              revokedAt: null,
            },
          },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    take: input.limit ?? 12,
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      team: {
        select: { name: true },
      },
    },
  });

  return entries
    .map((entry) => {
      const dueState = determineLiveDueState(entry.dueDate, now);
      if (entry.dueDate === null || dueState === "NONE") return null;

      return {
        entryId: entry.id,
        title: entry.title,
        href: `/entries/${entry.id}`,
        priority: entry.priority,
        dueDate: entry.dueDate,
        dueState,
        teamName: entry.team?.name ?? null,
      } satisfies LiveDueAwarenessItem;
    })
    .filter((item): item is LiveDueAwarenessItem => item !== null);
}
