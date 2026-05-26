import { EntryStatus, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/entries");

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: organizationId,
      action: "entry.delete",
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: organizationId, deletedAt: null },
    select: { id: true, sourceTaskId: true },
  });

  if (!entry) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  await db.entry.update({
    where: { id: entry.id },
    data: { deletedAt: new Date(), status: EntryStatus.ARCHIVED, version: { increment: 1 } },
  });

  if (entry.sourceTaskId) {
    await db.followUpTask.update({
      where: { id: entry.sourceTaskId },
      data: { status: TaskStatus.CANCELLED },
    });
  }

  await writeEntryActivity({
    organizationId: organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.DELETED,
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
