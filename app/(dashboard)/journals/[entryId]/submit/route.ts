import { EntryStatus, EntryType, JournalAssignmentStatus, JournalVersionChangeType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { canSubmitJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";
import { buildJournalVersionSnapshotCreateInput } from "@/lib/journals/versioning";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }
  const organizationId = scope.organizationId;
  const actorPersonId = scope.auth.personId;

  const journal = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId,
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
      journalAssignmentId: true,
    },
  });

  if (!journal) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId,
    actorPersonId,
  });

  if (!canSubmitJournal(accessContext, journal)) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  const submittedAt = new Date();
  await db.$transaction(async (tx) => {
    const updatedEntry = await tx.entry.update({
      where: { id: entryId },
      data: {
        status: EntryStatus.DONE,
        completedAt: submittedAt,
        updatedByPersonId: actorPersonId,
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
        organizationId,
        entryId: updatedEntry.id,
        versionNumber: updatedEntry.version,
        changeType: JournalVersionChangeType.SUBMITTED,
        title: updatedEntry.title,
        content: updatedEntry.content,
        visibility: updatedEntry.visibility,
        status: updatedEntry.status,
        fromStatus: journal.status,
        toStatus: EntryStatus.DONE,
        capturedByPersonId: actorPersonId,
        changeReason: "Journal finalized/submitted.",
      }),
    });

    // Arc 23C: Mark linked assignment as COMPLETED when athlete submits their response.
    // This tracks completion status without exposing journal body text.
    if (journal.journalAssignmentId) {
      await tx.journalAssignment.updateMany({
        where: {
          id: journal.journalAssignmentId,
          organizationId,
          status: { in: [JournalAssignmentStatus.ACTIVE, JournalAssignmentStatus.PENDING] },
        },
        data: {
          status: JournalAssignmentStatus.COMPLETED,
        },
      });
    }
  });

  await writeEntryActivity({
    organizationId,
    entryId,
    actorPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_SUBMITTED,
    // Never store journal body/title in activity metadata.
    metadata: {
      submittedAt: submittedAt.toISOString(),
      hasPrompt: Boolean(journal.journalAssignmentId),
    },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
