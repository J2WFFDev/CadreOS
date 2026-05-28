import { EntryStatus, EntryType, JournalVersionChangeType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { canArchiveJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";
import { buildJournalVersionSnapshotCreateInput } from "@/lib/journals/versioning";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const journal = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      version: true,
      status: true,
      visibility: true,
      createdByPersonId: true,
      teamId: true,
      team: { select: { programId: true } },
    },
  });

  if (!journal) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canArchiveJournal(accessContext, journal)) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  const archivedAt = new Date();
  await db.$transaction(async (tx) => {
    const updatedEntry = await tx.entry.update({
      where: { id: entryId },
      data: {
        status: EntryStatus.ARCHIVED,
        updatedByPersonId: scope.auth.personId,
        version: { increment: 1 },
      },
      select: {
        id: true,
        version: true,
        title: true,
        content: true,
        visibility: true,
        status: true,
      },
    });

    await tx.journalVersion.create({
      data: buildJournalVersionSnapshotCreateInput({
        organizationId: scope.organizationId,
        entryId: updatedEntry.id,
        versionNumber: updatedEntry.version,
        changeType: JournalVersionChangeType.ARCHIVED,
        title: updatedEntry.title,
        content: updatedEntry.content,
        visibility: updatedEntry.visibility,
        status: updatedEntry.status,
        fromStatus: journal.status,
        toStatus: EntryStatus.ARCHIVED,
        capturedByPersonId: scope.auth.personId,
        changeReason: "Journal archived.",
      }),
    });
  });

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_ARCHIVED,
    metadata: { archivedAt: archivedAt.toISOString() },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
