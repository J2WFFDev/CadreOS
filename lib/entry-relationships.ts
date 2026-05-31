import {
  EntryStatus,
  EntryType,
  HabitStatus,
  OperationalGraphNodeType,
  OperationalRelationshipType,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  canEditHabit,
  canReadHabit,
  resolveHabitAccessContext,
  type HabitRecord,
} from "@/lib/habits/access";
import { labelForHabitStatus } from "@/lib/habits/policy";
import {
  canEditJournalDraft,
  canReadJournalEntry,
  resolveJournalAccessContext,
} from "@/lib/journals/access";
import { labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import {
  ENTRY_ACTIVITY_ACTIONS,
  meetsAccessLevel,
  resolveEntryAccess,
  writeEntryActivity,
} from "@/lib/operational-entry";

export const FOUNDATION_RELATIONSHIP_TYPES = [
  OperationalRelationshipType.RELATED_TO,
  OperationalRelationshipType.BLOCKS,
  OperationalRelationshipType.BLOCKED_BY,
  OperationalRelationshipType.CREATED_FROM,
  OperationalRelationshipType.FOLLOW_UP_FOR,
  OperationalRelationshipType.SUPPORTS,
  OperationalRelationshipType.REFERENCES,
  OperationalRelationshipType.DUPLICATES,
 ] as const satisfies readonly OperationalRelationshipType[];

export type FoundationRelationshipType = (typeof FOUNDATION_RELATIONSHIP_TYPES)[number];

const FOUNDATION_STORED_RELATIONSHIP_TYPES = FOUNDATION_RELATIONSHIP_TYPES.filter(
  (relationshipType) => relationshipType !== OperationalRelationshipType.BLOCKED_BY,
) as FoundationRelationshipType[];

export const FOUNDATION_RELATIONSHIP_TARGET_TYPES: OperationalGraphNodeType[] = [
  OperationalGraphNodeType.ENTRY,
  OperationalGraphNodeType.HABIT,
];

const FOUNDATION_ENTRY_TYPES: EntryType[] = [
  EntryType.TASK,
  EntryType.NOTE,
  EntryType.DECISION,
  EntryType.EVENT,
  EntryType.JOURNAL,
];

type RelationshipDirection = "OUTBOUND" | "INBOUND";

export type FoundationRelationshipNodeType = "ENTRY" | "HABIT";

export type RelationshipNodeRef = {
  nodeType: FoundationRelationshipNodeType;
  nodeId: string;
};

type RelationshipNodeSummary = {
  nodeType: RelationshipNodeRef["nodeType"];
  nodeId: string;
  title: string;
  typeLabel: string;
  statusLabel: string | null;
  href: string | null;
};

export type FoundationRelationshipListItem = {
  id: string;
  relationshipType: OperationalRelationshipType;
  relationshipLabel: string;
  direction: RelationshipDirection;
  note: string | null;
  related: RelationshipNodeSummary;
  canRemove: boolean;
  unlink: {
    fromNodeType: RelationshipNodeRef["nodeType"];
    fromNodeId: string;
    toNodeType: RelationshipNodeRef["nodeType"];
    toNodeId: string;
    relationshipType: OperationalRelationshipType;
  };
};

export type RelationshipSearchCandidate = RelationshipNodeSummary;

export function isFoundationRelationshipType(value: string): value is FoundationRelationshipType {
  return FOUNDATION_RELATIONSHIP_TYPES.includes(value as FoundationRelationshipType);
}

export function isFoundationRelationshipNodeType(value: string): value is FoundationRelationshipNodeType {
  return FOUNDATION_RELATIONSHIP_TARGET_TYPES.includes(value as FoundationRelationshipNodeType);
}

export function parseRelationshipTargetNodeType(value: string | null | undefined): FoundationRelationshipNodeType {
  const normalized = value?.toUpperCase() ?? "";
  return isFoundationRelationshipNodeType(normalized) ? normalized : OperationalGraphNodeType.ENTRY;
}

function compareNodeRefs(left: RelationshipNodeRef, right: RelationshipNodeRef) {
  // Keep symmetric relationship pairs in a stable order so one stored row can serve both directions.
  return `${left.nodeType}:${left.nodeId}`.localeCompare(`${right.nodeType}:${right.nodeId}`);
}

export function normalizeFoundationRelationship(input: {
  from: RelationshipNodeRef;
  to: RelationshipNodeRef;
  relationshipType: OperationalRelationshipType;
}) {
  if (input.relationshipType === OperationalRelationshipType.BLOCKED_BY) {
    return {
      from: input.to,
      to: input.from,
      relationshipType: OperationalRelationshipType.BLOCKS,
    };
  }

  if (
    (input.relationshipType === OperationalRelationshipType.RELATED_TO ||
      input.relationshipType === OperationalRelationshipType.DUPLICATES) &&
    compareNodeRefs(input.from, input.to) > 0
  ) {
    return {
      from: input.to,
      to: input.from,
      relationshipType: input.relationshipType,
    };
  }

  return input;
}

const OUTBOUND_RELATIONSHIP_LABELS: Record<FoundationRelationshipType, string> = {
  RELATED_TO: "Related to",
  BLOCKS: "Blocks",
  BLOCKED_BY: "Blocked by",
  CREATED_FROM: "Created from",
  FOLLOW_UP_FOR: "Follow-up for",
  SUPPORTS: "Supports",
  REFERENCES: "References",
  DUPLICATES: "Duplicates",
};

const INBOUND_RELATIONSHIP_LABELS: Record<FoundationRelationshipType, string> = {
  RELATED_TO: "Related to",
  BLOCKS: "Blocked by",
  BLOCKED_BY: "Blocks",
  CREATED_FROM: "Source for",
  FOLLOW_UP_FOR: "Has follow-up",
  SUPPORTS: "Supported by",
  REFERENCES: "Referenced by",
  DUPLICATES: "Duplicates",
};

export function labelForRelationshipDirection(
  relationshipType: FoundationRelationshipType,
  direction: RelationshipDirection,
): string {
  return direction === "OUTBOUND"
    ? OUTBOUND_RELATIONSHIP_LABELS[relationshipType] ?? relationshipType
    : INBOUND_RELATIONSHIP_LABELS[relationshipType] ?? relationshipType;
}

function parseRelationshipNote(metadataJson: string | null): string | null {
  if (!metadataJson) return null;

  try {
    const parsed = JSON.parse(metadataJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return typeof parsed.note === "string" && parsed.note.trim().length > 0 ? parsed.note.trim() : null;
  } catch {
    return null;
  }
}

function toHabitRecord(input: {
  id: string;
  athletePersonId: string;
  assignedToTeamId: string | null;
  createdByPersonId: string;
  status: HabitStatus;
  assignedToTeam: { programId: string } | null;
}): HabitRecord {
  return {
    id: input.id,
    athletePersonId: input.athletePersonId,
    assignedToTeamId: input.assignedToTeamId,
    createdByPersonId: input.createdByPersonId,
    status: input.status,
    teamProgramId: input.assignedToTeam?.programId ?? null,
  };
}

async function resolveEntryNodeSummary(input: {
  organizationId: string;
  actorPersonId: string | null;
  entryId: string;
}): Promise<RelationshipNodeSummary | null> {
  const entry = await db.entry.findFirst({
    where: {
      id: input.entryId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      visibility: true,
      teamId: true,
      createdByPersonId: true,
      team: { select: { programId: true } },
    },
  });

  if (!entry || !FOUNDATION_ENTRY_TYPES.includes(entry.type)) {
    return null;
  }

  if (entry.type === EntryType.JOURNAL) {
    const accessContext = await resolveJournalAccessContext({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
    });

    const canRead = canReadJournalEntry(accessContext, {
      id: entry.id,
      type: entry.type,
      createdByPersonId: entry.createdByPersonId,
      status: entry.status,
      visibility: entry.visibility,
      teamId: entry.teamId,
      teamProgramId: entry.team?.programId ?? null,
    });

    if (!canRead) {
      return null;
    }
  } else {
    const access = await resolveEntryAccess({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
    });

    if (!meetsAccessLevel(access.level, "READ")) {
      return null;
    }
  }

  return {
    nodeType: OperationalGraphNodeType.ENTRY,
    nodeId: entry.id,
    title: entry.title,
    typeLabel: labelForEntryType(entry.type),
    statusLabel: labelForEntryStatus(entry.status),
    href: entry.type === EntryType.JOURNAL ? `/journals/${entry.id}` : `/entries/${entry.id}`,
  };
}

async function resolveHabitNodeSummary(input: {
  organizationId: string;
  actorPersonId: string | null;
  habitId: string;
}): Promise<RelationshipNodeSummary | null> {
  const habit = await db.habit.findFirst({
    where: { id: input.habitId, organizationId: input.organizationId },
    select: {
      id: true,
      title: true,
      status: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      assignedToTeam: { select: { programId: true } },
    },
  });

  if (!habit) {
    return null;
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
  });

  if (!canReadHabit(accessContext, toHabitRecord(habit))) {
    return null;
  }

  return {
    nodeType: OperationalGraphNodeType.HABIT,
    nodeId: habit.id,
    title: habit.title,
    typeLabel: "Habit",
    statusLabel: labelForHabitStatus(habit.status),
    href: `/habits/${habit.id}`,
  };
}

async function resolveNodeSummary(input: {
  organizationId: string;
  actorPersonId: string | null;
  node: RelationshipNodeRef;
}): Promise<RelationshipNodeSummary | null> {
  if (input.node.nodeType === OperationalGraphNodeType.ENTRY) {
    return resolveEntryNodeSummary({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
      entryId: input.node.nodeId,
    });
  }

  return resolveHabitNodeSummary({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    habitId: input.node.nodeId,
  });
}

export async function canWriteRelationshipSource(input: {
  organizationId: string;
  actorPersonId: string | null;
  source: RelationshipNodeRef;
}): Promise<boolean> {
  if (!input.actorPersonId) {
    return false;
  }

  if (input.source.nodeType === OperationalGraphNodeType.ENTRY) {
    const entry = await db.entry.findFirst({
      where: {
        id: input.source.nodeId,
        organizationId: input.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        type: true,
        status: true,
        visibility: true,
        teamId: true,
        createdByPersonId: true,
        team: { select: { programId: true } },
      },
    });

    if (!entry || !FOUNDATION_ENTRY_TYPES.includes(entry.type)) {
      return false;
    }

    if (entry.type === EntryType.JOURNAL) {
      const accessContext = await resolveJournalAccessContext({
        organizationId: input.organizationId,
        actorPersonId: input.actorPersonId,
      });
      return canEditJournalDraft(accessContext, entry);
    }

    const access = await resolveEntryAccess({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
    });
    return meetsAccessLevel(access.level, "WRITE");
  }

  const habit = await db.habit.findFirst({
    where: { id: input.source.nodeId, organizationId: input.organizationId },
    select: {
      id: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      status: true,
      assignedToTeam: { select: { programId: true } },
    },
  });

  if (!habit) {
    return false;
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
  });

  return canEditHabit(accessContext, toHabitRecord(habit));
}

async function writeHabitRelationshipActivity(input: {
  organizationId: string;
  habitId: string;
  actorPersonId: string | null;
  action: string;
  metadata: Record<string, unknown>;
}) {
  await db.habitActivity.create({
    data: {
      organizationId: input.organizationId,
      habitId: input.habitId,
      actorPersonId: input.actorPersonId,
      action: input.action,
      metadata: JSON.stringify(input.metadata),
    },
  });
}

async function writeRelationshipActivity(input: {
  organizationId: string;
  actorPersonId: string | null;
  action: "added" | "removed";
  relationshipType: OperationalRelationshipType;
  from: RelationshipNodeRef;
  to: RelationshipNodeRef;
  note: string | null;
}) {
  const [fromSummary, toSummary] = await Promise.all([
    resolveNodeSummary({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
      node: input.from,
    }),
    resolveNodeSummary({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
      node: input.to,
    }),
  ]);

  const metadata = {
    relationshipType: input.relationshipType,
    source: {
      nodeType: input.from.nodeType,
      nodeId: input.from.nodeId,
      title: fromSummary?.title ?? null,
      typeLabel: fromSummary?.typeLabel ?? null,
    },
    target: {
      nodeType: input.to.nodeType,
      nodeId: input.to.nodeId,
      title: toSummary?.title ?? null,
      typeLabel: toSummary?.typeLabel ?? null,
    },
    note: input.note,
  };

  const entryAction =
    input.action === "added"
      ? ENTRY_ACTIVITY_ACTIONS.ENTRY_RELATIONSHIP_ADDED
      : ENTRY_ACTIVITY_ACTIONS.ENTRY_RELATIONSHIP_REMOVED;
  const habitAction =
    input.action === "added"
      ? ENTRY_ACTIVITY_ACTIONS.HABIT_RELATIONSHIP_ADDED
      : ENTRY_ACTIVITY_ACTIONS.HABIT_RELATIONSHIP_REMOVED;

  if (input.from.nodeType === OperationalGraphNodeType.ENTRY) {
    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: input.from.nodeId,
      actorPersonId: input.actorPersonId,
      action: entryAction,
      metadata,
    });
  } else {
    await writeHabitRelationshipActivity({
      organizationId: input.organizationId,
      habitId: input.from.nodeId,
      actorPersonId: input.actorPersonId,
      action: habitAction,
      metadata,
    });
  }

  if (input.to.nodeType === OperationalGraphNodeType.ENTRY) {
    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: input.to.nodeId,
      actorPersonId: input.actorPersonId,
      action: entryAction,
      metadata,
    });
  } else {
    await writeHabitRelationshipActivity({
      organizationId: input.organizationId,
      habitId: input.to.nodeId,
      actorPersonId: input.actorPersonId,
      action: habitAction,
      metadata,
    });
  }
}

export async function listFoundationRelationships(input: {
  organizationId: string;
  actorPersonId: string | null;
  source: RelationshipNodeRef;
  limit?: number;
}): Promise<FoundationRelationshipListItem[]> {
  const rows = await db.operationalRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      removedAt: null,
      relationshipType: { in: FOUNDATION_STORED_RELATIONSHIP_TYPES },
      OR: [
        { fromNodeType: input.source.nodeType, fromNodeId: input.source.nodeId },
        { toNodeType: input.source.nodeType, toNodeId: input.source.nodeId },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 20,
    select: {
      id: true,
      fromNodeType: true,
      fromNodeId: true,
      toNodeType: true,
      toNodeId: true,
      relationshipType: true,
      metadataJson: true,
    },
  });

  const items = await Promise.all(
    rows.map(async (row) => {
      if (!isFoundationRelationshipNodeType(row.fromNodeType) || !isFoundationRelationshipNodeType(row.toNodeType)) {
        return null;
      }

      const sourceIsFromNode = row.fromNodeType === input.source.nodeType && row.fromNodeId === input.source.nodeId;
      const sourceIsToNode = row.toNodeType === input.source.nodeType && row.toNodeId === input.source.nodeId;

      if (!sourceIsFromNode && !sourceIsToNode) {
        return null;
      }

      const direction: RelationshipDirection = sourceIsFromNode ? "OUTBOUND" : "INBOUND";

      const relatedNode: RelationshipNodeRef =
        direction === "OUTBOUND"
          ? { nodeType: row.toNodeType, nodeId: row.toNodeId }
          : { nodeType: row.fromNodeType, nodeId: row.fromNodeId };

      const related = await resolveNodeSummary({
        organizationId: input.organizationId,
        actorPersonId: input.actorPersonId,
        node: relatedNode,
      });

      if (!related) {
        return null;
      }

      const canRemove = await canWriteRelationshipSource({
        organizationId: input.organizationId,
        actorPersonId: input.actorPersonId,
        source: {
          nodeType: row.fromNodeType,
          nodeId: row.fromNodeId,
        },
      });

      return {
        id: row.id,
        relationshipType: row.relationshipType,
        relationshipLabel: labelForRelationshipDirection(row.relationshipType as FoundationRelationshipType, direction),
        direction,
        note: parseRelationshipNote(row.metadataJson),
        related,
        canRemove,
        unlink: {
          fromNodeType: row.fromNodeType,
          fromNodeId: row.fromNodeId,
          toNodeType: row.toNodeType,
          toNodeId: row.toNodeId,
          relationshipType: row.relationshipType,
        },
      } satisfies FoundationRelationshipListItem;
    }),
  );

  return items.filter((item): item is FoundationRelationshipListItem => Boolean(item));
}

export async function searchRelationshipTargets(input: {
  organizationId: string;
  actorPersonId: string | null;
  source: RelationshipNodeRef;
  targetNodeType: RelationshipNodeRef["nodeType"];
  query: string;
  limit?: number;
}): Promise<RelationshipSearchCandidate[]> {
  const limit = input.limit ?? 8;
  const trimmedQuery = input.query.trim();

  if (input.targetNodeType === OperationalGraphNodeType.ENTRY) {
    const access = await resolveEntryAccess({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
    });

    if (!meetsAccessLevel(access.level, "READ")) {
      return [];
    }

    const entries = await db.entry.findMany({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        type: { in: FOUNDATION_ENTRY_TYPES },
        status: { not: EntryStatus.ARCHIVED },
        ...(input.source.nodeType === OperationalGraphNodeType.ENTRY ? { id: { not: input.source.nodeId } } : {}),
        ...(trimmedQuery
          ? {
              title: {
                contains: trimmedQuery,
                mode: "insensitive" as const,
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit * 3,
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        visibility: true,
        teamId: true,
        createdByPersonId: true,
        team: { select: { programId: true } },
      },
    });

    const journalAccessContext = await resolveJournalAccessContext({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
    });

    const visible = entries
      .filter((entry) => {
        if (entry.type !== EntryType.JOURNAL) {
          return true;
        }

        return canReadJournalEntry(journalAccessContext, {
          id: entry.id,
          type: entry.type,
          createdByPersonId: entry.createdByPersonId,
          status: entry.status,
          visibility: entry.visibility,
          teamId: entry.teamId,
          teamProgramId: entry.team?.programId ?? null,
        });
      })
      .slice(0, limit);

    return visible.map((entry) => ({
      nodeType: OperationalGraphNodeType.ENTRY,
      nodeId: entry.id,
      title: entry.title,
      typeLabel: labelForEntryType(entry.type),
      statusLabel: labelForEntryStatus(entry.status),
      href: entry.type === EntryType.JOURNAL ? `/journals/${entry.id}` : `/entries/${entry.id}`,
    }));
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
  });

  const habits = await db.habit.findMany({
    where: {
      organizationId: input.organizationId,
      status: { not: HabitStatus.ARCHIVED },
      archivedAt: null,
      ...(input.source.nodeType === OperationalGraphNodeType.HABIT ? { id: { not: input.source.nodeId } } : {}),
      ...(trimmedQuery
        ? {
            title: {
              contains: trimmedQuery,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit * 3,
    select: {
      id: true,
      title: true,
      status: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      assignedToTeam: { select: { programId: true } },
    },
  });

  return habits
    .filter((habit) => canReadHabit(accessContext, toHabitRecord(habit)))
    .slice(0, limit)
    .map((habit) => ({
      nodeType: OperationalGraphNodeType.HABIT,
      nodeId: habit.id,
      title: habit.title,
      typeLabel: "Habit",
      statusLabel: labelForHabitStatus(habit.status),
      href: `/habits/${habit.id}`,
    }));
}

export async function createFoundationRelationship(input: {
  organizationId: string;
  actorPersonId: string | null;
  from: RelationshipNodeRef;
  to: RelationshipNodeRef;
  relationshipType: OperationalRelationshipType;
  note?: string | null;
}) {
  if (!input.actorPersonId) {
    throw new Error("An authenticated actor is required.");
  }

  const normalized = normalizeFoundationRelationship({
    from: input.from,
    to: input.to,
    relationshipType: input.relationshipType,
  });

  if (normalized.from.nodeType === normalized.to.nodeType && normalized.from.nodeId === normalized.to.nodeId) {
    throw new Error("Cannot relate an item to itself.");
  }

  const canWriteSource = await canWriteRelationshipSource({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    source: normalized.from,
  });

  if (!canWriteSource) {
    throw new Error("The source item is not writable.");
  }

  const [sourceSummary, targetSummary] = await Promise.all([
    resolveNodeSummary({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
      node: normalized.from,
    }),
    resolveNodeSummary({
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
      node: normalized.to,
    }),
  ]);

  if (!sourceSummary) {
    throw new Error("The source item was not found.");
  }

  if (!targetSummary) {
    throw new Error("The target item is not readable.");
  }

  const note = input.note?.trim() ? input.note.trim() : null;

  const relationship = await db.operationalRelationship.upsert({
    where: {
      organizationId_fromNodeType_fromNodeId_toNodeType_toNodeId_relationshipType: {
        organizationId: input.organizationId,
        fromNodeType: normalized.from.nodeType,
        fromNodeId: normalized.from.nodeId,
        toNodeType: normalized.to.nodeType,
        toNodeId: normalized.to.nodeId,
        relationshipType: normalized.relationshipType,
      },
    },
    create: {
      organizationId: input.organizationId,
      fromNodeType: normalized.from.nodeType,
      fromNodeId: normalized.from.nodeId,
      toNodeType: normalized.to.nodeType,
      toNodeId: normalized.to.nodeId,
      relationshipType: normalized.relationshipType,
      createdByPersonId: input.actorPersonId,
      metadataJson: note ? JSON.stringify({ note }) : null,
    },
    update: {
      removedAt: null,
      metadataJson: note ? JSON.stringify({ note }) : null,
    },
    select: {
      id: true,
      fromNodeType: true,
      fromNodeId: true,
      toNodeType: true,
      toNodeId: true,
      relationshipType: true,
    },
  });

  await writeRelationshipActivity({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    action: "added",
    relationshipType: relationship.relationshipType,
    from: { nodeType: relationship.fromNodeType as FoundationRelationshipNodeType, nodeId: relationship.fromNodeId },
    to: { nodeType: relationship.toNodeType as FoundationRelationshipNodeType, nodeId: relationship.toNodeId },
    note,
  });

  return relationship;
}

export async function removeFoundationRelationship(input: {
  organizationId: string;
  actorPersonId: string | null;
  from: RelationshipNodeRef;
  to: RelationshipNodeRef;
  relationshipType: OperationalRelationshipType;
}) {
  if (!input.actorPersonId) {
    throw new Error("An authenticated actor is required.");
  }

  const relationship = await db.operationalRelationship.findFirst({
    where: {
      organizationId: input.organizationId,
      fromNodeType: input.from.nodeType,
      fromNodeId: input.from.nodeId,
      toNodeType: input.to.nodeType,
      toNodeId: input.to.nodeId,
      relationshipType: input.relationshipType,
      removedAt: null,
    },
    select: {
      id: true,
      fromNodeType: true,
      fromNodeId: true,
      toNodeType: true,
      toNodeId: true,
      relationshipType: true,
      metadataJson: true,
    },
  });

  if (!relationship) {
    return null;
  }

  const canWriteSource = await canWriteRelationshipSource({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    source: { nodeType: relationship.fromNodeType as FoundationRelationshipNodeType, nodeId: relationship.fromNodeId },
  });

  if (!canWriteSource) {
    throw new Error("The source item is not writable.");
  }

  await db.operationalRelationship.update({
    where: { id: relationship.id },
    data: { removedAt: new Date() },
  });

  await writeRelationshipActivity({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    action: "removed",
    relationshipType: relationship.relationshipType,
    from: { nodeType: relationship.fromNodeType as FoundationRelationshipNodeType, nodeId: relationship.fromNodeId },
    to: { nodeType: relationship.toNodeType as FoundationRelationshipNodeType, nodeId: relationship.toNodeId },
    note: parseRelationshipNote(relationship.metadataJson),
  });

  return relationship;
}
