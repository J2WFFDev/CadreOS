/**
 * Arc 24D.7 — Journal Entry First-Class Workflow
 *
 * Reopen route: transitions a Final (DONE) journal back to Draft (OPEN) state,
 * allowing the author to continue editing. Preserves journal metadata.
 *
 * Only the journal author or an org admin may reopen a Final journal.
 */

import { EntryStatus, EntryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveEntryOpsTypeAwareVisibilityWhere } from "@/lib/entryops/visibility";
import { writeEntryActivity } from "@/lib/entries/service";
import {
  hasJournalAdminAccess,
  resolveJournalAccessContext,
} from "@/lib/journals/access";
import { saveJournalWorkflowStatus } from "@/lib/journals/workflow";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const entryVisibilityWhere = await resolveEntryOpsTypeAwareVisibilityWhere({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const journal = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
      AND: [entryVisibilityWhere],
    },
    select: {
      id: true,
      type: true,
      status: true,
      createdByPersonId: true,
      teamId: true,
      team: { select: { programId: true } },
      typePayloads: {
        where: { entryType: EntryType.JOURNAL },
        select: { entryType: true, payloadJson: true },
        take: 1,
      },
    },
  });

  if (!journal) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  // Only Final (DONE) journals can be reopened
  if (journal.status !== EntryStatus.DONE) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  // Only the author or an org admin may reopen
  const isAuthor = scope.auth.personId === journal.createdByPersonId;
  const isAdmin = hasJournalAdminAccess(accessContext);
  if (!isAuthor && !isAdmin) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  // Update entry status to OPEN (Draft) and update journal payload status
  await db.entry.update({
    where: { id: entryId },
    data: {
      status: EntryStatus.OPEN,
      completedAt: null,
      updatedByPersonId: scope.auth.personId,
      version: { increment: 1 },
    },
  });

  // Update the journal payload to reflect DRAFT status
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
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_REOPENED,
    metadata: { reopenedAt: new Date().toISOString() },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
