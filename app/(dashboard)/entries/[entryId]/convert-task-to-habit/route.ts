import {
  EntryStatus,
  EntryType,
  OperationalGraphNodeType,
  OperationalRelationshipType,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  entryActionDeniedMessage,
  ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE,
  logEntryOpsAccessDecision,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsDetailAccessDecision,
  resolveEntryOpsVisibilityContext,
  buildEntryOpsEntryDetailVisibilityWhere,
} from "@/lib/entryops/visibility";
import { buildTaskToHabitCreateData } from "@/lib/habits/task-conversion";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";
import { canCreateHabit, resolveHabitAccessContext } from "@/lib/habits/access";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const organizationId = scope.organizationId;
  const actorPersonId = scope.auth.personId;
  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId,
    actorPersonId,
  });
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  const entryVisibilityWhere = buildEntryOpsEntryDetailVisibilityWhere(entryVisibility);

  const accessContext = await resolveHabitAccessContext({
    organizationId,
    actorPersonId,
  });

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId, deletedAt: null, AND: [entryVisibilityWhere] },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      type: true,
      status: true,
      assignedToPersonId: true,
      createdByPersonId: true,
      teamId: true,
      dueDate: true,
      sourceTaskId: true,
      taskRecurrenceRule: true,
    },
  });

  if (!entry || entry.type !== EntryType.TASK || entry.status === EntryStatus.ARCHIVED) {
    const url = new URL(returnTo, request.url);
    if (!entry) {
      const existingEntry = await db.entry.findFirst({
        where: { id: entryId, organizationId, deletedAt: null },
        select: {
          createdByPersonId: true,
          assignedToPersonId: true,
          teamId: true,
          team: { select: { programId: true } },
          assignments: { select: { personId: true, revokedAt: true }, take: 40 },
        },
      });
      logEntryOpsAccessDecision({
        workflow: "entries.convert-task-to-habit",
        entryId,
        organizationId,
        actorPersonId,
        decision: resolveEntryOpsDetailAccessDecision(visibilityContext, entryVisibility, existingEntry),
      });
      url.searchParams.set("error", ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE);
    } else {
      logEntryOpsAccessDecision({
        workflow: "entries.convert-task-to-habit",
        entryId,
        organizationId,
        actorPersonId,
        decision: { allowed: false, reasonCode: "ENTRY_ACTION_DENIED" },
      });
      url.searchParams.set("error", "Only an active task can be converted to a habit.");
    }
    return NextResponse.redirect(url, 303);
  }

  if (!canCreateHabit(accessContext)) {
    logEntryOpsAccessDecision({
      workflow: "entries.convert-task-to-habit",
      entryId,
      organizationId,
      actorPersonId,
      decision: { allowed: false, reasonCode: "ENTRY_ACTION_DENIED" },
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", entryActionDeniedMessage("convert this task to a habit"));
    return NextResponse.redirect(url, 303);
  }

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId,
      action: "entry.update",
    });
  } catch {
    logEntryOpsAccessDecision({
      workflow: "entries.convert-task-to-habit",
      entryId,
      organizationId,
      actorPersonId,
      decision: { allowed: false, reasonCode: "ENTRY_ACTION_DENIED" },
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", entryActionDeniedMessage("convert this task to a habit"));
    return NextResponse.redirect(url, 303);
  }

  const existingConversion = await db.operationalRelationship.findFirst({
    where: {
      organizationId,
      fromNodeType: OperationalGraphNodeType.HABIT,
      toNodeType: OperationalGraphNodeType.ENTRY,
      toNodeId: entry.id,
      relationshipType: OperationalRelationshipType.CREATED_FROM,
      removedAt: null,
    },
    select: { fromNodeId: true },
  });

  if (existingConversion) {
    return NextResponse.redirect(new URL(`/habits/${existingConversion.fromNodeId}`, request.url), 303);
  }

  const habit = await db.$transaction(async (tx) => {
    const createdHabit = await tx.habit.create({
      data: buildTaskToHabitCreateData(
        {
          title: entry.title,
          content: entry.content,
          assignedToPersonId: entry.assignedToPersonId,
          createdByPersonId: entry.createdByPersonId,
          teamId: entry.teamId,
          taskRecurrenceRule: entry.taskRecurrenceRule,
        },
        { organizationId, actorPersonId },
        { dueDate: entry.dueDate },
      ),
      select: { id: true },
    });

    const relationshipMetadata = JSON.stringify({
      note: "Converted from task",
      sourceEntryId: entry.id,
      sourceEntryType: entry.type,
      transferredTags: entry.tags,
      taskRecurrenceRule: entry.taskRecurrenceRule,
    });

    await tx.operationalRelationship.upsert({
      where: {
        organizationId_fromNodeType_fromNodeId_toNodeType_toNodeId_relationshipType: {
          organizationId,
          fromNodeType: OperationalGraphNodeType.HABIT,
          fromNodeId: createdHabit.id,
          toNodeType: OperationalGraphNodeType.ENTRY,
          toNodeId: entry.id,
          relationshipType: OperationalRelationshipType.CREATED_FROM,
        },
      },
      create: {
        organizationId,
        fromNodeType: OperationalGraphNodeType.HABIT,
        fromNodeId: createdHabit.id,
        toNodeType: OperationalGraphNodeType.ENTRY,
        toNodeId: entry.id,
        relationshipType: OperationalRelationshipType.CREATED_FROM,
        createdByPersonId: actorPersonId,
        metadataJson: relationshipMetadata,
      },
      update: {
        removedAt: null,
        metadataJson: relationshipMetadata,
      },
    });

    await tx.habitActivity.create({
      data: {
        organizationId,
        habitId: createdHabit.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.HABIT_CREATED,
        metadata: JSON.stringify({
          sourceEntryId: entry.id,
          sourceEntryType: entry.type,
          conversion: "task_to_habit",
        }),
      },
    });

    await tx.habitActivity.create({
      data: {
        organizationId,
        habitId: createdHabit.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.HABIT_RELATIONSHIP_ADDED,
        metadata: relationshipMetadata,
      },
    });

    await tx.entry.update({
      where: { id: entry.id },
      data: {
        status: EntryStatus.ARCHIVED,
        taskCompleted: false,
        completedAt: null,
        updatedByPersonId: actorPersonId,
        version: { increment: 1 },
      },
    });

    if (entry.sourceTaskId) {
      await tx.followUpTask.update({
        where: { id: entry.sourceTaskId },
        data: { status: TaskStatus.CANCELLED },
      });
    }

    await tx.entryActivity.create({
      data: {
        organizationId,
        entryId: entry.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.ENTRY_TASK_TO_HABIT_CONVERTED,
        metadataJson: JSON.stringify({
          habitId: createdHabit.id,
          fromStatus: entry.status,
          toStatus: EntryStatus.ARCHIVED,
          taskRecurrenceRule: entry.taskRecurrenceRule,
        }),
      },
    });

    await tx.entryActivity.create({
      data: {
        organizationId,
        entryId: entry.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.ENTRY_RELATIONSHIP_ADDED,
        metadataJson: relationshipMetadata,
      },
    });

    return createdHabit;
  });

  return NextResponse.redirect(new URL(`/habits/${habit.id}`, request.url), 303);
}
