import { EntryStatus, EntryType, JournalAssignmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { parseJournalEntryPayload, serializeJournalEntryPayload } from "@/lib/entries/journal-payload";
import { canSubmitJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

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
      status: true,
      visibility: true,
      createdByPersonId: true,
      teamId: true,
      team: { select: { programId: true } },
      journalAssignmentId: true,
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

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canSubmitJournal(accessContext, journal)) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  const submittedAt = new Date();
  const existingPayload = parseJournalEntryPayload(journal.typePayloads[0]?.payloadJson ?? null);
  const updatedPayload = { ...existingPayload, journalStatus: "FINAL" as const };

  await db.entry.update({
    where: { id: entryId },
    data: {
      status: EntryStatus.DONE,
      completedAt: submittedAt,
      updatedByPersonId: scope.auth.personId,
      version: { increment: 1 },
    },
  });

  await db.entryTypePayload.upsert({
    where: { entryId_entryType: { entryId, entryType: EntryType.JOURNAL } },
    update: {
      payloadJson: serializeJournalEntryPayload(updatedPayload),
      isActive: true,
      archivedAt: null,
    },
    create: {
      organizationId: scope.organizationId,
      entryId,
      entryType: EntryType.JOURNAL,
      payloadJson: serializeJournalEntryPayload(updatedPayload),
      isActive: true,
    },
  });

  // Arc 23C: Mark linked assignment as COMPLETED when athlete submits their response.
  // This tracks completion status without exposing journal body text.
  if (journal.journalAssignmentId) {
    await db.journalAssignment.updateMany({
      where: {
        id: journal.journalAssignmentId,
        organizationId: scope.organizationId,
        status: { in: [JournalAssignmentStatus.ACTIVE, JournalAssignmentStatus.PENDING] },
      },
      data: {
        status: JournalAssignmentStatus.COMPLETED,
      },
    });
  }

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_SUBMITTED,
    // Never store journal body/title in activity metadata.
    metadata: {
      submittedAt: submittedAt.toISOString(),
      hasPrompt: Boolean(journal.journalAssignmentId),
    },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
