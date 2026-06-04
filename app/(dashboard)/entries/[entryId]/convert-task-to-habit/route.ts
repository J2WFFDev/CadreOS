import {
  EntryStatus,
  EntryType,
  OperationalGraphNodeType,
  OperationalRelationshipType,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveEntryOpsEntryActionVisibilityWhere } from "@/lib/entryops/visibility";
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
  const entryVisibilityWhere = await resolveEntryOpsEntryActionVisibilityWhere({
    organizationId,
    actorPersonId,
  });

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId,
      action: "entry.update",
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId,
    actorPersonId,
  });

  if (!canCreateHabit(accessContext)) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

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
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
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
