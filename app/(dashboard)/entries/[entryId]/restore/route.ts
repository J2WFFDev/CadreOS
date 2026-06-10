import { EntryStatus, EntryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveEntryRestoreStatus } from "@/lib/entries/lifecycle";
import { canRestoreEntry } from "@/lib/entries/lifecycle-access";
import { mapEntryStatusToTaskStatus, writeEntryActivity } from "@/lib/entries/service";
import {
  buildEntryOpsEntryDetailVisibilityWhere,
  entryActionDeniedMessage,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsVisibilityContext,
} from "@/lib/entryops/visibility";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL("/entries", request.url), 303);
  }

  const organizationId = scope.organizationId;
  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  const entry = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId,
      status: EntryStatus.ARCHIVED,
      type: { not: EntryType.JOURNAL },
      AND: [buildEntryOpsEntryDetailVisibilityWhere(entryVisibility)],
    },
    select: { id: true, sourceTaskId: true, createdByPersonId: true },
  });

  if (!entry) {
    return NextResponse.redirect(new URL("/entries?status=ARCHIVED", request.url), 303);
  }

  const canRestore = await canRestoreEntry({
    actorPersonId: scope.auth.personId,
    actorUserId: scope.auth.clerkUserId,
    organizationId,
    entry,
  });
  if (!canRestore) {
    const url = new URL(`/entries/${entryId}`, request.url);
    url.searchParams.set("error", entryActionDeniedMessage("restore this work item"));
    return NextResponse.redirect(url, 303);
  }

  const archiveHistory = await db.entryStatusHistory.findFirst({
    where: { organizationId, entryId, toStatus: EntryStatus.ARCHIVED },
    orderBy: { changedAt: "desc" },
    select: { fromStatus: true },
  });
  const restoredStatus = resolveEntryRestoreStatus(archiveHistory?.fromStatus);

  await db.$transaction(async (tx) => {
    await tx.entry.update({
      where: { id: entry.id },
      data: {
        deletedAt: null,
        status: restoredStatus,
        updatedByPersonId: scope.auth.personId,
        version: { increment: 1 },
      },
    });

    await tx.entryStatusHistory.create({
      data: {
        organizationId,
        entryId: entry.id,
        fromStatus: EntryStatus.ARCHIVED,
        toStatus: restoredStatus,
        changedByPersonId: scope.auth.personId,
        note: "Restored",
      },
    });

    if (entry.sourceTaskId) {
      await tx.followUpTask.updateMany({
        where: { id: entry.sourceTaskId, organizationId },
        data: { status: mapEntryStatusToTaskStatus(restoredStatus) },
      });
    }
  });

  await writeEntryActivity({
    organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_RESTORED,
    metadata: { restoredAt: new Date().toISOString(), toStatus: restoredStatus },
  });

  return NextResponse.redirect(new URL(`/entries/${entryId}`, request.url), 303);
}
