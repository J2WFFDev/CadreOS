import { EntryPriority, EntryType, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildTaskEntryProjection, deriveEntryFollowUpDraft, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

function parseDueAt(rawValue: string): Date | null {
  if (!rawValue.trim()) return null;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

  try {
    await Promise.all([
      requirePermission({
        actorUserId: scope.auth.clerkUserId,
        organizationId,
        action: "entry.update",
      }),
      requirePermission({
        actorUserId: scope.auth.clerkUserId,
        organizationId,
        action: "task.create",
      }),
    ]);
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const sourceEntry = await db.entry.findFirst({
    where: { id: entryId, organizationId, deletedAt: null },
    select: {
      id: true,
      title: true,
      content: true,
      teamId: true,
      visibility: true,
      priority: true,
      assignedToPersonId: true,
      sourceNoteId: true,
    },
  });

  if (!sourceEntry) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const draft = deriveEntryFollowUpDraft({
    entryTitle: sourceEntry.title,
    entryContent: sourceEntry.content,
    providedTitle: String(formData.get("title") ?? ""),
    providedDescription: String(formData.get("description") ?? ""),
  });

  const dueAt = parseDueAt(String(formData.get("dueAt") ?? ""));
  const assigneePersonId =
    String(formData.get("assigneePersonId") ?? "").trim() || sourceEntry.assignedToPersonId || actorPersonId;
  const priorityRaw = String(formData.get("priority") ?? "").trim().toUpperCase();
  const priority = Object.values(EntryPriority).includes(priorityRaw as EntryPriority)
    ? (priorityRaw as EntryPriority)
    : sourceEntry.priority;

  const assignee = await db.person.findFirst({
    where: { id: assigneePersonId, organizationId },
    select: { id: true },
  });

  if (!assignee) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const followUpTask = await db.followUpTask.create({
    data: {
      organizationId,
      title: draft.title,
      description: draft.description,
      status: TaskStatus.OPEN,
      assigneePersonId: assignee.id,
      createdByPersonId: actorPersonId,
      dueAt,
      sourceNoteId: sourceEntry.sourceNoteId,
    },
    select: { id: true },
  });

  const projection = buildTaskEntryProjection({ dueAt, status: TaskStatus.OPEN });
  const followUpEntry = await db.entry.create({
    data: {
      organizationId,
      teamId: sourceEntry.teamId,
      type: EntryType.FOLLOW_UP,
      title: draft.title,
      content: draft.description,
      createdByPersonId: actorPersonId,
      assignedToPersonId: assignee.id,
      visibility: sourceEntry.visibility,
      status: projection.status,
      priority,
      dueDate: projection.dueDate,
      dueTime: projection.dueTime,
      timezone: "UTC",
      taskCompleted: false,
      sourceTaskId: followUpTask.id,
      parentEntryId: sourceEntry.id,
    },
    select: { id: true },
  });

  await writeEntryActivity({
    organizationId,
    entryId: sourceEntry.id,
    actorPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.FOLLOW_UP_CREATED,
    metadata: {
      followUpTaskId: followUpTask.id,
      followUpEntryId: followUpEntry.id,
      assignedToPersonId: assignee.id,
    },
  });

  await writeEntryActivity({
    organizationId,
    entryId: followUpEntry.id,
    actorPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_CREATED,
    metadata: {
      sourceEntryId: sourceEntry.id,
      sourceTaskId: followUpTask.id,
    },
  });
  await writeEntryActivity({
    organizationId,
    entryId: followUpEntry.id,
    actorPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED,
    metadata: {
      personId: assignee.id,
      role: "OWNER",
      sourceEntryId: sourceEntry.id,
    },
  });
  await writeEntryActivity({
    organizationId,
    entryId: followUpEntry.id,
    actorPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.FOLLOW_UP_ASSIGNED,
    metadata: {
      personId: assignee.id,
      role: "OWNER",
      sourceEntryId: sourceEntry.id,
    },
  });

  return NextResponse.redirect(new URL(`/entries/${sourceEntry.id}`, request.url), 303);
}
