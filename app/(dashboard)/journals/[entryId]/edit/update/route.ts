import { EntryType, EntryVisibility } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { canEditJournalDraft, resolveJournalAccessContext } from "@/lib/journals/access";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/lib/journals/policy";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

function normalizeJournalVisibility(rawValue: string): EntryVisibility {
  const normalized = rawValue.trim().toUpperCase();
  if (normalized === EntryVisibility.TEAM_STAFF) return EntryVisibility.TEAM_STAFF;
  if (normalized === EntryVisibility.ORGANIZATION_SCOPED) return EntryVisibility.ORGANIZATION_SCOPED;
  return EntryVisibility.STAFF_ONLY;
}

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
    },
  });

  if (!journal) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canEditJournalDraft(accessContext, journal)) {
    return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const visibility = normalizeJournalVisibility(String(formData.get("visibility") ?? journal.visibility));

  if (!title || !content) {
    return NextResponse.redirect(new URL(`/journals/${entryId}/edit`, request.url), 303);
  }

  await db.entry.update({
    where: { id: entryId },
    data: {
      title: title.slice(0, MAX_JOURNAL_TITLE_LENGTH),
      content,
      visibility,
      updatedByPersonId: scope.auth.personId,
      version: { increment: 1 },
    },
  });

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_DRAFT_UPDATED,
    metadata: { visibility },
  });

  return NextResponse.redirect(new URL(`/journals/${entryId}`, request.url), 303);
}
