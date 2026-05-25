import { EntryType, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { deriveTaskCompletionUpdate, writeEntryActivity } from "@/lib/entries/service";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: scope.organizationId, deletedAt: null },
    select: { id: true, type: true, sourceTaskId: true },
  });

  if (!entry || entry.type !== EntryType.TASK) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const completedAt = new Date();
  const completionUpdate = deriveTaskCompletionUpdate(completedAt);
  await db.entry.update({
    where: { id: entry.id },
    data: {
      status: completionUpdate.status,
      taskCompleted: completionUpdate.taskCompleted,
      completedAt: completionUpdate.completedAt,
      version: { increment: 1 },
    },
  });

  if (entry.sourceTaskId) {
    await db.followUpTask.update({
      where: { id: entry.sourceTaskId },
      data: { status: TaskStatus.DONE },
    });
  }

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: "entry.task_completed",
    metadata: { completedAt: completedAt.toISOString() },
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
