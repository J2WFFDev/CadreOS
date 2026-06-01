import {
  EntryObjectLinkTargetType,
  EntryPriority,
  EntryStatus,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemInspectionResult,
  GearItemLifecycleStatus,
  GearKitInspectionStatus,
  GearKitCustodyStatus,
  GearKitReadinessLabel,
  GearMaintenanceDueStatus,
  GearReservationStatus,
  InventoryReadinessState,
  TaskStatus,
  type GearInspectionDueStatus,
} from "@prisma/client";

import { db } from "@/lib/db";
import { defaultRelationshipTypeForEntryObjectTarget } from "@/lib/entries/object-links";
import { upsertEntryFromTask, writeEntryActivity } from "@/lib/entries/service";
import { writeFollowUpTaskEntryRuntimeRef } from "@/lib/entry-runtime";
import { formatDateTime, formatEnumLabel } from "@/lib/follow-up-tasks";
import { ENTRY_ACTIVITY_ACTIONS, linkEntryToObject } from "@/lib/operational-entry";
import { linkOperationalRecords, mapEntryObjectLinkTargetToGraphNodeType } from "@/lib/operational-graph";

export const GEAR_WORKFLOW_TAG = "gear-ops";
export const GEAR_WORKFLOW_BLOCKING_TAG = "gear-blocking";

const OPEN_ENTRY_STATUSES: EntryStatus[] = [EntryStatus.OPEN, EntryStatus.IN_PROGRESS];
const ACTIVE_ASSIGNMENT_STATUSES: GearAssignmentStatus[] = [
  GearAssignmentStatus.PENDING,
  GearAssignmentStatus.ACTIVE,
  GearAssignmentStatus.OVERDUE,
];
const ACTIVE_CHECKOUT_STATUSES: GearCheckoutStatus[] = [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE];
const ACTIVE_RESERVATION_STATUSES: GearReservationStatus[] = [
  GearReservationStatus.ACTIVE,
  GearReservationStatus.PENDING_REVIEW,
  GearReservationStatus.CONFLICT,
];

export const GEAR_TASK_TEMPLATE_KEYS = [
  "MAINTENANCE_REQUEST",
  "MISSING_EQUIPMENT_INVESTIGATION",
  "DAMAGE_REVIEW",
  "INVENTORY_AUDIT",
  "CONDITION_INSPECTION",
] as const;

export type GearTaskTemplateKey = (typeof GEAR_TASK_TEMPLATE_KEYS)[number];

export const GEAR_OPERATIONAL_EVENT_KINDS = [
  "INSPECTION_FAILURE",
  "MISSING_INVENTORY",
  "DAMAGED_INVENTORY",
  "MAINTENANCE_REQUIRED",
  "OUT_OF_SERVICE_CONDITION",
  "LOST_INVENTORY",
  "EXPIRED_INSPECTION",
] as const;

export type GearOperationalEventKind = (typeof GEAR_OPERATIONAL_EVENT_KINDS)[number];
export type GearWorkflowDashboardCategory = "maintenance" | "missing" | "damage";
export type GearWorkflowSubjectType = "GEAR_ITEM" | "INVENTORY_KIT";

export type GearWorkflowTaskSuggestion = {
  templateKey: GearTaskTemplateKey;
  eventKind: GearOperationalEventKind;
  actionLabel: string;
  reason: string;
  blocking: boolean;
};

export type GearWorkflowTaskListItem = {
  entryId: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  dueAt: Date | null;
  assigneeName: string;
  updatedAt: Date;
  tags: string[];
  templateKey: GearTaskTemplateKey | null;
  eventKind: GearOperationalEventKind | null;
  blocking: boolean;
};

const GEAR_TASK_TEMPLATES: Record<
  GearTaskTemplateKey,
  {
    title: string;
    priority: EntryPriority;
    dashboardCategory: GearWorkflowDashboardCategory | null;
    blocking: boolean;
  }
> = {
  MAINTENANCE_REQUEST: {
    title: "Maintenance Request",
    priority: EntryPriority.HIGH,
    dashboardCategory: "maintenance",
    blocking: true,
  },
  MISSING_EQUIPMENT_INVESTIGATION: {
    title: "Missing Equipment Investigation",
    priority: EntryPriority.URGENT,
    dashboardCategory: "missing",
    blocking: true,
  },
  DAMAGE_REVIEW: {
    title: "Damage Review",
    priority: EntryPriority.HIGH,
    dashboardCategory: "damage",
    blocking: true,
  },
  INVENTORY_AUDIT: {
    title: "Inventory Audit",
    priority: EntryPriority.MEDIUM,
    dashboardCategory: null,
    blocking: false,
  },
  CONDITION_INSPECTION: {
    title: "Condition Inspection",
    priority: EntryPriority.MEDIUM,
    dashboardCategory: "maintenance",
    blocking: false,
  },
};

function formatPersonName(person: { firstName: string; lastName: string } | null | undefined) {
  if (!person) return "Unknown person";
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  return fullName.length > 0 ? fullName : "Unknown person";
}

function formatDateLine(value: Date | null | undefined) {
  return value ? formatDateTime(value) : "—";
}

function titleForGearWorkflowTask(templateKey: GearTaskTemplateKey, subjectName: string, assetId?: string | null) {
  const prefix = GEAR_TASK_TEMPLATES[templateKey].title;
  const suffix = assetId ? `${subjectName} (${assetId})` : subjectName;
  return `${prefix} — ${suffix}`;
}

export function gearWorkflowTemplateTag(templateKey: GearTaskTemplateKey) {
  return `gear-template:${templateKey}`;
}

export function gearWorkflowEventTag(eventKind: GearOperationalEventKind) {
  return `gear-event:${eventKind}`;
}

export function gearWorkflowDashboardTag(category: GearWorkflowDashboardCategory) {
  return `gear-dashboard:${category}`;
}

export function parseGearWorkflowTemplateTag(tags: string[]): GearTaskTemplateKey | null {
  const tag = tags.find((value) => value.startsWith("gear-template:"));
  if (!tag) return null;
  const templateKey = tag.slice("gear-template:".length);
  return GEAR_TASK_TEMPLATE_KEYS.includes(templateKey as GearTaskTemplateKey)
    ? (templateKey as GearTaskTemplateKey)
    : null;
}

export function parseGearWorkflowEventTag(tags: string[]): GearOperationalEventKind | null {
  const tag = tags.find((value) => value.startsWith("gear-event:"));
  if (!tag) return null;
  const eventKind = tag.slice("gear-event:".length);
  return GEAR_OPERATIONAL_EVENT_KINDS.includes(eventKind as GearOperationalEventKind)
    ? (eventKind as GearOperationalEventKind)
    : null;
}

export function buildGearWorkflowTags(input: {
  templateKey: GearTaskTemplateKey;
  eventKind: GearOperationalEventKind;
  subjectType: GearWorkflowSubjectType;
}) {
  const template = GEAR_TASK_TEMPLATES[input.templateKey];
  return [
    GEAR_WORKFLOW_TAG,
    "entry-ops",
    "gear-workflow",
    `gear-subject:${input.subjectType.toLowerCase()}`,
    gearWorkflowTemplateTag(input.templateKey),
    gearWorkflowEventTag(input.eventKind),
    ...(template.blocking ? [GEAR_WORKFLOW_BLOCKING_TAG] : []),
    ...(template.dashboardCategory ? [gearWorkflowDashboardTag(template.dashboardCategory)] : []),
  ];
}

function buildTaskDescription(input: {
  templateKey: GearTaskTemplateKey;
  eventKind: GearOperationalEventKind;
  subjectHeading: string;
  subjectLines: string[];
  reservationLines: string[];
  custodyLines: string[];
  inspectionLines: string[];
  relevantLinks: Array<{ label: string; href: string }>;
}) {
  return [
    `${GEAR_TASK_TEMPLATES[input.templateKey].title} created from GearOps operational context.`,
    "",
    "Operational event",
    `- ${formatEnumLabel(input.eventKind)}`,
    "",
    input.subjectHeading,
    ...input.subjectLines.map((line) => `- ${line}`),
    "",
    "Reservation context",
    ...(input.reservationLines.length > 0 ? input.reservationLines.map((line) => `- ${line}`) : ["- No active reservation context."]),
    "",
    "Custody context",
    ...(input.custodyLines.length > 0 ? input.custodyLines.map((line) => `- ${line}`) : ["- No active custody context."]),
    "",
    "Inspection findings",
    ...(input.inspectionLines.length > 0 ? input.inspectionLines.map((line) => `- ${line}`) : ["- No inspection findings captured."]),
    "",
    "Relevant links",
    ...input.relevantLinks.map((link) => `- ${link.label}: ${link.href}`),
  ].join("\n");
}

export function deriveGearItemTaskSuggestions(input: {
  inventoryType: GearInventoryType;
  lifecycleStatus: GearItemLifecycleStatus;
  readinessState: InventoryReadinessState | null;
  conditionStatus: GearConditionStatus | null;
  quantityOnHand: number;
  quantityMin: number | null;
  lastInspectionResult: GearItemInspectionResult | null;
  inspectionDueStatus: GearInspectionDueStatus;
  maintenanceDueStatus: GearMaintenanceDueStatus;
}): GearWorkflowTaskSuggestion[] {
  const suggestions: GearWorkflowTaskSuggestion[] = [];
  const push = (suggestion: GearWorkflowTaskSuggestion) => {
    if (!suggestions.some((entry) => entry.templateKey === suggestion.templateKey && entry.eventKind === suggestion.eventKind)) {
      suggestions.push(suggestion);
    }
  };

  if (input.lifecycleStatus === GearItemLifecycleStatus.LOST) {
    push({
      templateKey: "MISSING_EQUIPMENT_INVESTIGATION",
      eventKind: "LOST_INVENTORY",
      actionLabel: "Create missing item task",
      reason: "Item is marked lost and needs accountability follow-up.",
      blocking: true,
    });
  }

  if (input.conditionStatus === GearConditionStatus.DAMAGED) {
    push({
      templateKey: "DAMAGE_REVIEW",
      eventKind: "DAMAGED_INVENTORY",
      actionLabel: "Create damage review task",
      reason: "Condition is damaged and needs review before reuse.",
      blocking: true,
    });
  }

  if (
    input.lastInspectionResult === GearItemInspectionResult.OUT_OF_SERVICE ||
    input.readinessState === "NOT_READY"
  ) {
    push({
      templateKey: "MAINTENANCE_REQUEST",
      eventKind: "OUT_OF_SERVICE_CONDITION",
      actionLabel: "Create out-of-service task",
      reason: "Item is out of service and should stay unavailable pending maintenance review.",
      blocking: true,
    });
  }

  if (
    input.lastInspectionResult === GearItemInspectionResult.FAILED ||
    input.lastInspectionResult === GearItemInspectionResult.MAINTENANCE_NEEDED ||
    input.readinessState === "MAINTENANCE_REQUIRED" ||
    input.maintenanceDueStatus === GearMaintenanceDueStatus.OVERDUE
  ) {
    push({
      templateKey: "MAINTENANCE_REQUEST",
      eventKind: "MAINTENANCE_REQUIRED",
      actionLabel: "Create maintenance task",
      reason: "Maintenance is required before the item should return to service.",
      blocking: true,
    });
  }

  if (
    input.inspectionDueStatus === "OVERDUE" ||
    input.inspectionDueStatus === "DUE"
  ) {
    push({
      templateKey: "CONDITION_INSPECTION",
      eventKind: "EXPIRED_INSPECTION",
      actionLabel: "Create inspection task",
      reason: "Inspection coverage is due or overdue and should be tracked in EntryOps.",
      blocking: false,
    });
  }

  if (
    input.inventoryType === GearInventoryType.CONSUMABLE &&
    input.quantityMin !== null &&
    input.quantityOnHand <= input.quantityMin
  ) {
    push({
      templateKey: "INVENTORY_AUDIT",
      eventKind: "MISSING_INVENTORY",
      actionLabel: "Create inventory audit task",
      reason: "Consumable quantity is at or below threshold and should be audited.",
      blocking: false,
    });
  }

  return suggestions;
}

export function deriveGearKitTaskSuggestions(input: {
  missingRequiredCount: number;
  outOfServiceCount: number;
  lastInspectionStatus: GearKitInspectionStatus | null;
}): GearWorkflowTaskSuggestion[] {
  const suggestions: GearWorkflowTaskSuggestion[] = [];

  if (input.missingRequiredCount > 0) {
    suggestions.push({
      templateKey: "MISSING_EQUIPMENT_INVESTIGATION",
      eventKind: "MISSING_INVENTORY",
      actionLabel: "Create missing item task",
      reason: "Kit is incomplete and needs missing-component follow-up.",
      blocking: true,
    });
  }

  if (input.outOfServiceCount > 0) {
    suggestions.push({
      templateKey: "DAMAGE_REVIEW",
      eventKind: "OUT_OF_SERVICE_CONDITION",
      actionLabel: "Create damage review task",
      reason: "Kit contains out-of-service items that need review.",
      blocking: true,
    });
  }

  if (input.lastInspectionStatus === "FAILED" || input.lastInspectionStatus === "INCOMPLETE") {
    suggestions.push({
      templateKey: "CONDITION_INSPECTION",
      eventKind: "INSPECTION_FAILURE",
      actionLabel: "Create inspection task",
      reason: "Kit inspection needs follow-up in EntryOps.",
      blocking: false,
    });
  }

  return suggestions;
}

export function deriveGearItemAvailabilityUpdate(input: {
  templateKey: GearTaskTemplateKey;
  eventKind: GearOperationalEventKind;
  currentLifecycleStatus: GearItemLifecycleStatus;
  currentReadinessState: InventoryReadinessState | null;
}): { lifecycleStatus: GearItemLifecycleStatus; readinessState: InventoryReadinessState } | null {
  switch (input.templateKey) {
    case "MAINTENANCE_REQUEST":
      return {
        lifecycleStatus:
          input.currentLifecycleStatus === GearItemLifecycleStatus.LOST
            ? input.currentLifecycleStatus
            : GearItemLifecycleStatus.MAINTENANCE,
        readinessState:
          input.eventKind === "OUT_OF_SERVICE_CONDITION"
            ? InventoryReadinessState.NOT_READY
            : InventoryReadinessState.MAINTENANCE_REQUIRED,
      };
    case "DAMAGE_REVIEW":
      return {
        lifecycleStatus:
          input.currentLifecycleStatus === GearItemLifecycleStatus.LOST
            ? input.currentLifecycleStatus
            : GearItemLifecycleStatus.QUARANTINED,
        readinessState: InventoryReadinessState.NOT_READY,
      };
    case "MISSING_EQUIPMENT_INVESTIGATION":
      return {
        lifecycleStatus: GearItemLifecycleStatus.LOST,
        readinessState: InventoryReadinessState.NOT_READY,
      };
    case "CONDITION_INSPECTION":
      return input.currentReadinessState === InventoryReadinessState.READY
        ? { lifecycleStatus: input.currentLifecycleStatus, readinessState: InventoryReadinessState.NEEDS_INSPECTION }
        : null;
    default:
      return null;
  }
}

export function deriveGearKitAvailabilityUpdate(input: {
  templateKey: GearTaskTemplateKey;
  currentReadinessLabel: GearKitReadinessLabel;
  currentCustodyStatus: GearKitCustodyStatus;
}): { readinessLabel: GearKitReadinessLabel; custodyStatus: GearKitCustodyStatus } | null {
  switch (input.templateKey) {
    case "MAINTENANCE_REQUEST":
      return {
        readinessLabel: GearKitReadinessLabel.MAINTENANCE_NEEDED,
        custodyStatus: GearKitCustodyStatus.IN_MAINTENANCE,
      };
    case "DAMAGE_REVIEW":
      return {
        readinessLabel: GearKitReadinessLabel.OUT_OF_SERVICE,
        custodyStatus: GearKitCustodyStatus.IN_INSPECTION,
      };
    case "MISSING_EQUIPMENT_INVESTIGATION":
      return {
        readinessLabel: GearKitReadinessLabel.MISSING_COMPONENTS,
        custodyStatus: GearKitCustodyStatus.IN_INSPECTION,
      };
    case "CONDITION_INSPECTION":
      return input.currentReadinessLabel === GearKitReadinessLabel.READY && input.currentCustodyStatus === GearKitCustodyStatus.AVAILABLE
        ? { readinessLabel: GearKitReadinessLabel.NEEDS_INSPECTION, custodyStatus: GearKitCustodyStatus.IN_INSPECTION }
        : null;
    default:
      return null;
  }
}

function mapEntryStatusToTaskStatus(status: EntryStatus): TaskStatus {
  if (status === EntryStatus.DONE) return TaskStatus.DONE;
  if (status === EntryStatus.CANCELLED || status === EntryStatus.ARCHIVED) return TaskStatus.CANCELLED;
  if (status === EntryStatus.IN_PROGRESS) return TaskStatus.IN_PROGRESS;
  return TaskStatus.OPEN;
}

function mapTaskListItem(entry: {
  id: string;
  updatedAt: Date;
  tags: string[];
  sourceTask: {
    id: string;
    title: string;
    status: TaskStatus;
    dueAt: Date | null;
    assignee: { firstName: string; lastName: string };
  } | null;
}): GearWorkflowTaskListItem | null {
  if (!entry.sourceTask) return null;
  return {
    entryId: entry.id,
    taskId: entry.sourceTask.id,
    title: entry.sourceTask.title,
    status: entry.sourceTask.status,
    dueAt: entry.sourceTask.dueAt,
    assigneeName: formatPersonName(entry.sourceTask.assignee),
    updatedAt: entry.updatedAt,
    tags: entry.tags,
    templateKey: parseGearWorkflowTemplateTag(entry.tags),
    eventKind: parseGearWorkflowEventTag(entry.tags),
    blocking: entry.tags.includes(GEAR_WORKFLOW_BLOCKING_TAG),
  };
}

export async function listGearWorkflowTasksForObject(input: {
  organizationId: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
  includeResolved?: boolean;
}) {
  const entries = await db.entry.findMany({
    where: {
      organizationId: input.organizationId,
      sourceTaskId: { not: null },
      tags: { has: GEAR_WORKFLOW_TAG },
      ...(input.includeResolved ? {} : { status: { in: OPEN_ENTRY_STATUSES } }),
      objectLinks: {
        some: {
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
    },
    select: {
      id: true,
      updatedAt: true,
      tags: true,
      sourceTask: {
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assignee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 12,
  });

  return entries.map(mapTaskListItem).filter((entry): entry is GearWorkflowTaskListItem => Boolean(entry));
}

export async function listOpenGearWorkflowTasks(input: {
  organizationId: string;
  limit?: number;
}) {
  const entries = await db.entry.findMany({
    where: {
      organizationId: input.organizationId,
      sourceTaskId: { not: null },
      tags: { has: GEAR_WORKFLOW_TAG },
      status: { in: OPEN_ENTRY_STATUSES },
      objectLinks: {
        some: {
          targetType: { in: [EntryObjectLinkTargetType.GEAR_ITEM, EntryObjectLinkTargetType.INVENTORY_KIT] },
        },
      },
    },
    select: {
      id: true,
      updatedAt: true,
      tags: true,
      sourceTask: {
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assignee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: input.limit ?? 5,
  });

  return entries.map(mapTaskListItem).filter((entry): entry is GearWorkflowTaskListItem => Boolean(entry));
}

async function findExistingOpenGearWorkflowTask(input: {
  organizationId: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
  templateKey: GearTaskTemplateKey;
}) {
  const existing = await db.entry.findFirst({
    where: {
      organizationId: input.organizationId,
      sourceTaskId: { not: null },
      status: { in: OPEN_ENTRY_STATUSES },
      tags: { has: gearWorkflowTemplateTag(input.templateKey) },
      objectLinks: {
        some: {
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
    },
    select: { sourceTaskId: true },
  });

  return existing?.sourceTaskId ?? null;
}

async function linkEntryToTarget(input: {
  organizationId: string;
  entryId: string;
  createdByPersonId: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
}) {
  await linkEntryToObject({
    organizationId: input.organizationId,
    entryId: input.entryId,
    createdByPersonId: input.createdByPersonId,
    targetType: input.targetType,
    targetId: input.targetId,
  });

  await linkOperationalRecords({
    organizationId: input.organizationId,
    from: { nodeType: "ENTRY", nodeId: input.entryId },
    to: { nodeType: mapEntryObjectLinkTargetToGraphNodeType(input.targetType), nodeId: input.targetId },
    relationshipType: defaultRelationshipTypeForEntryObjectTarget(input.targetType),
    createdByPersonId: input.createdByPersonId,
  });
}

async function createGearWorkflowEntryTask(input: {
  organizationId: string;
  createdByPersonId: string;
  assigneePersonId: string;
  templateKey: GearTaskTemplateKey;
  eventKind: GearOperationalEventKind;
  subjectType: GearWorkflowSubjectType;
  title: string;
  description: string;
  links: Array<{ targetType: EntryObjectLinkTargetType; targetId: string }>;
}) {
  const template = GEAR_TASK_TEMPLATES[input.templateKey];
  const task = await db.followUpTask.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      status: TaskStatus.OPEN,
      assigneePersonId: input.assigneePersonId,
      createdByPersonId: input.createdByPersonId,
    },
    select: {
      id: true,
      organizationId: true,
      createdByPersonId: true,
    },
  });

  const entry = await upsertEntryFromTask({
    organizationId: input.organizationId,
    task: {
      id: task.id,
      title: input.title,
      description: input.description,
      status: TaskStatus.OPEN,
      priority: template.priority,
      assigneePersonId: input.assigneePersonId,
      createdByPersonId: input.createdByPersonId,
      dueAt: null,
      tags: buildGearWorkflowTags({
        templateKey: input.templateKey,
        eventKind: input.eventKind,
        subjectType: input.subjectType,
      }),
    },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: entry.id,
    actorPersonId: input.createdByPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.GEAR_TASK_CREATED,
    metadata: {
      sourceTaskId: task.id,
      templateKey: input.templateKey,
      eventKind: input.eventKind,
    },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: entry.id,
    actorPersonId: input.createdByPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED,
    metadata: {
      sourceTaskId: task.id,
      personId: input.assigneePersonId,
      role: "OWNER",
    },
  });

  for (const link of input.links) {
    await linkEntryToTarget({
      organizationId: input.organizationId,
      entryId: entry.id,
      createdByPersonId: input.createdByPersonId,
      targetType: link.targetType,
      targetId: link.targetId,
    });

    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: entry.id,
      actorPersonId: input.createdByPersonId,
      action: ENTRY_ACTIVITY_ACTIONS.GEAR_TASK_LINKED,
      metadata: {
        sourceTaskId: task.id,
        targetType: link.targetType,
        targetId: link.targetId,
      },
    });
  }

  await writeFollowUpTaskEntryRuntimeRef({
    organizationId: input.organizationId,
    task: {
      id: task.id,
      organizationId: task.organizationId,
      createdByPersonId: task.createdByPersonId,
      sourceNoteId: null,
      sourceEventId: null,
      sourceNoteVisibility: null,
      sourceNoteEventId: null,
      sourceNoteTeamId: null,
      sourceNoteAthletePersonId: null,
      sourceNoteEventTeamId: null,
      sourceEventTeamId: null,
      sourceNoteTeamProgramId: null,
      sourceNoteEventProgramId: null,
      sourceEventProgramId: null,
    },
  });

  return { taskId: task.id, entryId: entry.id };
}

export async function createGearWorkflowTask(input: {
  organizationId: string;
  createdByPersonId: string;
  templateKey: GearTaskTemplateKey;
  eventKind: GearOperationalEventKind;
  subjectType: GearWorkflowSubjectType;
  subjectId: string;
}) {
  if (input.subjectType === "GEAR_ITEM") {
    const existingTaskId = await findExistingOpenGearWorkflowTask({
      organizationId: input.organizationId,
      targetType: EntryObjectLinkTargetType.GEAR_ITEM,
      targetId: input.subjectId,
      templateKey: input.templateKey,
    });

    if (existingTaskId) {
      return { taskId: existingTaskId, created: false };
    }

    const item = await db.gearItem.findFirst({
      where: { id: input.subjectId, organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        assetId: true,
        inventoryType: true,
        lifecycleStatus: true,
        readinessState: true,
        conditionStatus: true,
        quantityOnHand: true,
        quantityMin: true,
        category: { select: { name: true } },
        location: { select: { name: true } },
        reservations: {
          where: { status: { in: ACTIVE_RESERVATION_STATUSES } },
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            windowStartAt: true,
            windowEndAt: true,
            reservedFor: { select: { firstName: true, lastName: true } },
            reservedTeam: { select: { name: true } },
            reservedEvent: { select: { title: true } },
          },
        },
        assignments: {
          where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          orderBy: [{ assignedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            assignedAt: true,
            assignedTo: { select: { firstName: true, lastName: true } },
            assignedTeam: { select: { name: true } },
            assignedEvent: { select: { title: true } },
          },
        },
        checkouts: {
          where: { status: { in: ACTIVE_CHECKOUT_STATUSES } },
          orderBy: [{ checkedOutAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            checkedOutAt: true,
            expectedReturnAt: true,
            checkedOutBy: { select: { firstName: true, lastName: true } },
            event: { select: { title: true } },
          },
        },
        inspectionRecords: {
          orderBy: [{ performedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            result: true,
            context: true,
            notes: true,
            performedAt: true,
          },
        },
        maintenanceLogs: {
          orderBy: [{ performedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            maintenanceType: true,
            performedAt: true,
            notes: true,
          },
        },
      },
    });

    if (!item) return null;

    const reservation = item.reservations[0] ?? null;
    const assignment = item.assignments[0] ?? null;
    const checkout = item.checkouts[0] ?? null;
    const inspection = item.inspectionRecords[0] ?? null;
    const maintenance = item.maintenanceLogs[0] ?? null;
    const description = buildTaskDescription({
      templateKey: input.templateKey,
      eventKind: input.eventKind,
      subjectHeading: "Item details",
      subjectLines: [
        `Item: ${item.name}`,
        `Asset ID: ${item.assetId ?? "—"}`,
        `Category: ${item.category.name}`,
        `Inventory type: ${formatEnumLabel(item.inventoryType)}`,
        `Lifecycle: ${formatEnumLabel(item.lifecycleStatus)}`,
        `Readiness: ${item.readinessState ? formatEnumLabel(item.readinessState) : "—"}`,
        `Condition: ${item.conditionStatus ? formatEnumLabel(item.conditionStatus) : "—"}`,
        `Location: ${item.location?.name ?? "—"}`,
      ],
      reservationLines: reservation
        ? [
            `Status: ${formatEnumLabel(reservation.status)}`,
            `Window: ${formatDateLine(reservation.windowStartAt)} → ${formatDateLine(reservation.windowEndAt)}`,
            `Reserved for: ${formatPersonName(reservation.reservedFor)}`,
            `Reserved team: ${reservation.reservedTeam?.name ?? "—"}`,
            `Reserved event: ${reservation.reservedEvent?.title ?? "—"}`,
          ]
        : [],
      custodyLines: checkout
        ? [
            `Checkout: ${formatEnumLabel(checkout.status)} at ${formatDateLine(checkout.checkedOutAt)}`,
            `Checked out by: ${formatPersonName(checkout.checkedOutBy)}`,
            `Expected return: ${formatDateLine(checkout.expectedReturnAt)}`,
            `Checkout event: ${checkout.event?.title ?? "—"}`,
          ]
        : assignment
          ? [
              `Assignment: ${formatEnumLabel(assignment.status)} at ${formatDateLine(assignment.assignedAt)}`,
              `Assigned to person: ${formatPersonName(assignment.assignedTo)}`,
              `Assigned team: ${assignment.assignedTeam?.name ?? "—"}`,
              `Assigned event: ${assignment.assignedEvent?.title ?? "—"}`,
            ]
          : [],
      inspectionLines: [
        ...(inspection
          ? [
              `Last inspection: ${formatEnumLabel(inspection.result)} at ${formatDateLine(inspection.performedAt)}`,
              `Inspection context: ${formatEnumLabel(inspection.context)}`,
              `Inspection notes: ${inspection.notes ?? "—"}`,
            ]
          : []),
        ...(maintenance
          ? [
              `Latest maintenance log: ${formatEnumLabel(maintenance.maintenanceType)} at ${formatDateLine(maintenance.performedAt)}`,
              `Maintenance notes: ${maintenance.notes}`,
            ]
          : []),
      ],
      relevantLinks: [
        { label: "Gear item", href: `/gear-ops/items/${item.id}` },
        ...(checkout ? [{ label: "Open checkout", href: `/gear-ops/items/${item.id}/checkouts/${checkout.id}/edit` }] : []),
        ...(assignment ? [{ label: "Active assignment", href: `/gear-ops/items/${item.id}/assignments/${assignment.id}/edit` }] : []),
        ...(maintenance ? [{ label: "Latest maintenance log", href: `/gear-ops/items/${item.id}/maintenance/${maintenance.id}/edit` }] : []),
      ],
    });

    const created = await createGearWorkflowEntryTask({
      organizationId: input.organizationId,
      createdByPersonId: input.createdByPersonId,
      assigneePersonId: input.createdByPersonId,
      templateKey: input.templateKey,
      eventKind: input.eventKind,
      subjectType: input.subjectType,
      title: titleForGearWorkflowTask(input.templateKey, item.name, item.assetId),
      description,
      links: [
        { targetType: EntryObjectLinkTargetType.GEAR_ITEM, targetId: item.id },
        ...(checkout ? [{ targetType: EntryObjectLinkTargetType.GEAR_CHECKOUT, targetId: checkout.id }] : []),
        ...(assignment ? [{ targetType: EntryObjectLinkTargetType.GEAR_ASSIGNMENT, targetId: assignment.id }] : []),
        ...(maintenance ? [{ targetType: EntryObjectLinkTargetType.GEAR_MAINTENANCE_LOG, targetId: maintenance.id }] : []),
      ],
    });

    const availabilityUpdate = deriveGearItemAvailabilityUpdate({
      templateKey: input.templateKey,
      eventKind: input.eventKind,
      currentLifecycleStatus: item.lifecycleStatus,
      currentReadinessState: item.readinessState,
    });

    if (availabilityUpdate) {
      await db.gearItem.update({
        where: { id: item.id },
        data: availabilityUpdate,
      });
    }

    return { taskId: created.taskId, created: true };
  }

  const existingTaskId = await findExistingOpenGearWorkflowTask({
    organizationId: input.organizationId,
    targetType: EntryObjectLinkTargetType.INVENTORY_KIT,
    targetId: input.subjectId,
    templateKey: input.templateKey,
  });

  if (existingTaskId) {
    return { taskId: existingTaskId, created: false };
  }

  const kit = await db.inventoryKit.findFirst({
    where: { id: input.subjectId, organizationId: input.organizationId },
    select: {
      id: true,
      name: true,
      kitType: true,
      readinessLabel: true,
      custodyStatus: true,
      lastInspectionStatus: true,
      lastInspectedAt: true,
      assignedTo: { select: { firstName: true, lastName: true } },
      assignedToTeam: { select: { name: true } },
      assignedToEvent: { select: { title: true } },
      reservations: {
        where: { status: { in: ACTIVE_RESERVATION_STATUSES } },
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: {
          id: true,
          status: true,
          windowStartAt: true,
          windowEndAt: true,
          reservedFor: { select: { firstName: true, lastName: true } },
          reservedTeam: { select: { name: true } },
          reservedEvent: { select: { title: true } },
        },
      },
      inspections: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          status: true,
          notes: true,
          itemConditionsJson: true,
          missingItemIdsJson: true,
          createdAt: true,
        },
      },
      items: {
        where: { removedAt: null },
        select: {
          isRequired: true,
          gearItem: {
            select: {
              id: true,
              name: true,
              lifecycleStatus: true,
            },
          },
        },
      },
    },
  });

  if (!kit) return null;

  const reservation = kit.reservations[0] ?? null;
  const inspection = kit.inspections[0] ?? null;
  const missingItemIds = inspection?.missingItemIdsJson
    ? (JSON.parse(inspection.missingItemIdsJson) as string[])
    : [];
  const itemConditions = inspection?.itemConditionsJson
    ? (JSON.parse(inspection.itemConditionsJson) as Array<{ gearItemId: string; notes: string | null }> )
    : [];
  const description = buildTaskDescription({
    templateKey: input.templateKey,
    eventKind: input.eventKind,
    subjectHeading: "Kit details",
    subjectLines: [
      `Kit: ${kit.name}`,
      `Type: ${formatEnumLabel(kit.kitType)}`,
      `Readiness: ${formatEnumLabel(kit.readinessLabel)}`,
      `Custody: ${formatEnumLabel(kit.custodyStatus)}`,
      `Assigned person: ${formatPersonName(kit.assignedTo)}`,
      `Assigned team: ${kit.assignedToTeam?.name ?? "—"}`,
      `Assigned event: ${kit.assignedToEvent?.title ?? "—"}`,
      `Missing required components: ${kit.items.filter((item) => item.isRequired && item.gearItem.lifecycleStatus === GearItemLifecycleStatus.LOST).length}`,
      `Out-of-service components: ${kit.items.filter((item) => item.gearItem.lifecycleStatus !== GearItemLifecycleStatus.ACTIVE).length}`,
    ],
    reservationLines: reservation
      ? [
          `Status: ${formatEnumLabel(reservation.status)}`,
          `Window: ${formatDateLine(reservation.windowStartAt)} → ${formatDateLine(reservation.windowEndAt)}`,
          `Reserved for: ${formatPersonName(reservation.reservedFor)}`,
          `Reserved team: ${reservation.reservedTeam?.name ?? "—"}`,
          `Reserved event: ${reservation.reservedEvent?.title ?? "—"}`,
        ]
      : [],
    custodyLines: [
      `Current custody: ${formatEnumLabel(kit.custodyStatus)}`,
      `Assigned person: ${formatPersonName(kit.assignedTo)}`,
      `Assigned team: ${kit.assignedToTeam?.name ?? "—"}`,
      `Assigned event: ${kit.assignedToEvent?.title ?? "—"}`,
    ],
    inspectionLines: [
      ...(inspection
        ? [
            `Last inspection: ${formatEnumLabel(inspection.status)} at ${formatDateLine(inspection.createdAt)}`,
            `Inspection notes: ${inspection.notes ?? "—"}`,
            `Missing items captured: ${missingItemIds.length}`,
            `Item condition findings: ${itemConditions.length}`,
          ]
        : []),
      ...(itemConditions.length > 0
        ? itemConditions.slice(0, 3).map((entry) => `Condition note (${entry.gearItemId}): ${entry.notes ?? "—"}`)
        : []),
    ],
    relevantLinks: [{ label: "Inventory kit", href: `/gear-ops/kits/${kit.id}` }],
  });

  const created = await createGearWorkflowEntryTask({
    organizationId: input.organizationId,
    createdByPersonId: input.createdByPersonId,
    assigneePersonId: input.createdByPersonId,
    templateKey: input.templateKey,
    eventKind: input.eventKind,
    subjectType: input.subjectType,
    title: titleForGearWorkflowTask(input.templateKey, kit.name),
    description,
    links: [{ targetType: EntryObjectLinkTargetType.INVENTORY_KIT, targetId: kit.id }],
  });

  const availabilityUpdate = deriveGearKitAvailabilityUpdate({
    templateKey: input.templateKey,
    currentReadinessLabel: kit.readinessLabel,
    currentCustodyStatus: kit.custodyStatus,
  });

  if (availabilityUpdate) {
    await db.inventoryKit.update({
      where: { id: kit.id },
      data: availabilityUpdate,
    });
  }

  return { taskId: created.taskId, created: true };
}

export async function returnGearItemToService(input: {
  organizationId: string;
  itemId: string;
  actorPersonId: string;
}) {
  const item = await db.gearItem.findFirst({
    where: { id: input.itemId, organizationId: input.organizationId },
    select: { id: true, lifecycleStatus: true },
  });

  if (!item || item.lifecycleStatus === GearItemLifecycleStatus.LOST) {
    return { ok: false as const };
  }

  const linkedBlockingEntries = await db.entry.findMany({
    where: {
      organizationId: input.organizationId,
      sourceTaskId: { not: null },
      tags: { has: GEAR_WORKFLOW_BLOCKING_TAG },
      objectLinks: {
        some: {
          targetType: EntryObjectLinkTargetType.GEAR_ITEM,
          targetId: input.itemId,
        },
      },
    },
    select: { id: true, sourceTaskId: true, status: true },
  });

  if (
    linkedBlockingEntries.length === 0 ||
    linkedBlockingEntries.some((entry) => OPEN_ENTRY_STATUSES.includes(entry.status))
  ) {
    return { ok: false as const };
  }

  await db.gearItem.update({
    where: { id: item.id },
    data: {
      lifecycleStatus: GearItemLifecycleStatus.ACTIVE,
      readinessState: "READY",
    },
  });

  for (const entry of linkedBlockingEntries.filter((value) => value.status === EntryStatus.DONE)) {
    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: entry.id,
      actorPersonId: input.actorPersonId,
      action: ENTRY_ACTIVITY_ACTIONS.GEAR_ITEM_RETURNED_TO_SERVICE,
      metadata: {
        itemId: input.itemId,
        sourceTaskId: entry.sourceTaskId,
      },
    });
  }

  return { ok: true as const };
}

export async function countOpenGearWorkflowTasksByCategory(input: {
  organizationId: string;
  category: GearWorkflowDashboardCategory;
}) {
  return db.entry.count({
    where: {
      organizationId: input.organizationId,
      sourceTaskId: { not: null },
      status: { in: OPEN_ENTRY_STATUSES },
      tags: { has: gearWorkflowDashboardTag(input.category) },
      objectLinks: {
        some: {
          targetType: { in: [EntryObjectLinkTargetType.GEAR_ITEM, EntryObjectLinkTargetType.INVENTORY_KIT] },
        },
      },
    },
  });
}

export function taskStatusFromEntryStatus(status: EntryStatus) {
  return mapEntryStatusToTaskStatus(status);
}
