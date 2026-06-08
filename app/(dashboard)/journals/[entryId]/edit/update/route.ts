import { EntryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import {
  mapJournalPayloadVisibilityToEntryVisibility,
  normalizeJournalDateOnly,
  normalizeJournalPayloadVisibility,
  parseJournalEntryPayload,
  serializeJournalEntryPayload,
} from "@/lib/entries/journal-payload";
import { buildJournalEntryVisibilityWhere, canEditJournalDraft, resolveJournalAccessContext } from "@/lib/journals/access";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/lib/journals/policy";
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
        select: { entryType: true, payloadJson: true },
        take: 1,
      },
    },
  });

  if (!journal) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  if (!canEditJournalDraft(accessContext, journal)) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const rawJournalVisibility = String(formData.get("journalVisibility") ?? "PRIVATE").trim();
  const rawJournalDate = String(formData.get("journalDate") ?? "").trim();
  const rawJournalAuthor = String(formData.get("journalAuthor") ?? "").trim();

  if (!title || !content) {
    return NextResponse.redirect(new URL(`/journals/${entryId}/edit`, request.url), 303);
  }

  const journalVisibility = normalizeJournalPayloadVisibility(rawJournalVisibility);
  const journalDate = normalizeJournalDateOnly(rawJournalDate);
  const entryVisibility = mapJournalPayloadVisibilityToEntryVisibility(journalVisibility);

  // Merge with existing payload so we don't lose other fields
  const existingPayload = parseJournalEntryPayload(journal.typePayloads[0]?.payloadJson ?? null);
  const updatedPayload = {
    ...existingPayload,
    journalVisibility,
    journalDate,
    journalAuthor: rawJournalAuthor,
  };

  await db.entry.update({
    where: { id: entryId },
    data: {
      title: title.slice(0, MAX_JOURNAL_TITLE_LENGTH),
      content,
      visibility: entryVisibility,
      updatedByPersonId: scope.auth.personId,
      version: { increment: 1 },
    },
  });

  // Arc 24D.7: upsert journal payload
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

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_DRAFT_UPDATED,
    metadata: { journalVisibility },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
