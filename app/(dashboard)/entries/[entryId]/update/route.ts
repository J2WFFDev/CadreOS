import { EntryPriority, EntryStatus, EntryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { mapEntryStatusToTaskStatus, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: scope.organizationId,
      action: "entry.update",
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "").trim().toUpperCase();
  const statusValue = String(formData.get("status") ?? "").trim().toUpperCase();
  const priorityValue = String(formData.get("priority") ?? "").trim().toUpperCase();

  const type = Object.values(EntryType).includes(typeValue as EntryType) ? (typeValue as EntryType) : undefined;
  const status = Object.values(EntryStatus).includes(statusValue as EntryStatus) ? (statusValue as EntryStatus) : undefined;
  const priority = Object.values(EntryPriority).includes(priorityValue as EntryPriority)
    ? (priorityValue as EntryPriority)
    : undefined;

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: scope.organizationId, deletedAt: null },
    select: { id: true, sourceTaskId: true, sourceNoteId: true },
  });

  if (!entry) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  await db.entry.update({
    where: { id: entry.id },
    data: {
      ...(title ? { title } : {}),
      ...(content.length > 0 ? { content } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status, taskCompleted: status === EntryStatus.DONE, completedAt: status === EntryStatus.DONE ? new Date() : null } : {}),
      ...(priority ? { priority } : {}),
      version: { increment: 1 },
    },
  });

  if (entry.sourceTaskId && status) {
    await db.followUpTask.update({
      where: { id: entry.sourceTaskId },
      data: { status: mapEntryStatusToTaskStatus(status) },
    });
  }

  if (entry.sourceTaskId && title) {
    await db.followUpTask.update({
      where: { id: entry.sourceTaskId },
      data: { title, ...(content.length > 0 ? { description: content } : {}) },
    });
  }

  if (entry.sourceNoteId && content.length > 0) {
    await db.observationNote.update({
      where: { id: entry.sourceNoteId },
      data: { body: content },
    });
  }

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.UPDATED,
    metadata: { changedType: type ?? null, changedStatus: status ?? null, changedPriority: priority ?? null },
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
