import { EntryStatus, EntryType, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { deriveNoteToTaskTitle, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);
  const selectedText = String(formData.get("selectedText") ?? "").trim();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  try {
    await Promise.all([
      requirePermission({
        actorUserId: scope.auth.clerkUserId,
        organizationId: organizationId,
        action: "entry.update",
      }),
      requirePermission({
        actorUserId: scope.auth.clerkUserId,
        organizationId: organizationId,
        action: "task.create",
      }),
    ]);
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: organizationId, deletedAt: null },
    select: { id: true, type: true, sourceNoteId: true, sourceTaskId: true, title: true, content: true },
  });

  if (!entry || entry.type !== EntryType.NOTE || entry.sourceTaskId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const taskTitle = deriveNoteToTaskTitle({
    selectedText,
    title: entry.title,
    content: entry.content,
  });

  const createdTask = await db.followUpTask.create({
    data: {
      organizationId: organizationId,
      title: taskTitle,
      description: entry.content,
      status: TaskStatus.OPEN,
      assigneePersonId: scope.auth.personId,
      createdByPersonId: scope.auth.personId,
      sourceNoteId: entry.sourceNoteId,
    },
    select: { id: true },
  });

  await db.entry.update({
    where: { id: entry.id },
    data: {
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      sourceTaskId: createdTask.id,
      taskCompleted: false,
      completedAt: null,
      version: { increment: 1 },
    },
  });

  await writeEntryActivity({
    organizationId: organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.NOTE_TO_TASK_CONVERTED,
    metadata: { sourceTaskId: createdTask.id, selectedTextLength: selectedText.length },
  });

  return NextResponse.redirect(new URL(`/entries/${entry.id}`, request.url), 303);
}
