import { EntryStatus, EntryType, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { deriveNoteToTaskTitle, writeEntryActivity } from "@/lib/entries/service";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);
  const selectedText = String(formData.get("selectedText") ?? "").trim();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: scope.organizationId, deletedAt: null },
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
      organizationId: scope.organizationId,
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
    organizationId: scope.organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: "entry.note_converted_to_task",
    metadata: { sourceTaskId: createdTask.id, selectedTextLength: selectedText.length },
  });

  return NextResponse.redirect(new URL(`/entries/${entry.id}`, request.url), 303);
}
