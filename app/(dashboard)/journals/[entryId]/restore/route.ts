import { EntryStatus, EntryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { buildJournalEntryVisibilityWhere, canRestoreJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { saveJournalWorkflowStatus } from "@/lib/journals/workflow";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const journal = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
      AND: [buildJournalEntryVisibilityWhere(accessContext)],
    },
    select: {
      id: true,
      type: true,
      status: true,
      visibility: true,
      createdByPersonId: true,
      teamId: true,
      team: { select: { programId: true } },
      typePayloads: {
        where: { entryType: EntryType.JOURNAL },
        select: { payloadJson: true },
        take: 1,
      },
    },
  });

  if (!journal) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  if (journal.status !== EntryStatus.ARCHIVED) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  if (!canRestoreJournal(accessContext, journal)) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  await db.entry.update({
    where: { id: entryId },
    data: {
      status: EntryStatus.OPEN,
      completedAt: null,
      updatedByPersonId: scope.auth.personId,
      version: { increment: 1 },
    },
  });

  await saveJournalWorkflowStatus({
    organizationId: scope.organizationId,
    entryId,
    payloadJson: journal.typePayloads[0]?.payloadJson,
    journalStatus: "DRAFT",
  });

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_RESTORED,
    metadata: { restoredAt: new Date().toISOString() },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
