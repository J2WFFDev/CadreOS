import { EntryStatus, EntryType, EntryVisibility, JournalAssignmentStatus, JournalVersionChangeType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { canCreateJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/lib/journals/policy";
import { buildJournalVersionSnapshotCreateInput } from "@/lib/journals/versioning";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

function normalizeJournalVisibility(rawValue: string): EntryVisibility {
  const normalized = rawValue.trim().toUpperCase();
  if (normalized === EntryVisibility.TEAM_STAFF) return EntryVisibility.TEAM_STAFF;
  if (normalized === EntryVisibility.ORGANIZATION_SCOPED) return EntryVisibility.ORGANIZATION_SCOPED;
  return EntryVisibility.STAFF_ONLY;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canCreateJournal(accessContext)) {
    return NextResponse.redirect(new URL("/journals", request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const visibility = normalizeJournalVisibility(String(formData.get("visibility") ?? EntryVisibility.STAFF_ONLY));
  const journalPromptId = String(formData.get("journalPromptId") ?? "").trim() || null;
  const journalAssignmentId = String(formData.get("journalAssignmentId") ?? "").trim() || null;

  if (!title || !content) {
    return NextResponse.redirect(new URL("/journals/create", request.url), 303);
  }

  // Validate prompt belongs to organization if provided
  if (journalPromptId) {
    const prompt = await db.journalPrompt.findFirst({
      where: { id: journalPromptId, organizationId: scope.organizationId, active: true },
      select: { id: true },
    });
    if (!prompt) {
      return NextResponse.redirect(new URL("/journals/create", request.url), 303);
    }
  }

  // Validate assignment belongs to organization and is still open if provided
  if (journalAssignmentId) {
    const assignment = await db.journalAssignment.findFirst({
      where: {
        id: journalAssignmentId,
        organizationId: scope.organizationId,
        status: { in: [JournalAssignmentStatus.ACTIVE, JournalAssignmentStatus.PENDING] },
      },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.redirect(new URL("/journals/create", request.url), 303);
    }
  }

  const primaryRosterMembership = await db.rosterMembership.findFirst({
    where: {
      organizationId: scope.organizationId,
      personId: scope.auth.personId,
    },
    orderBy: { updatedAt: "desc" },
    select: { teamId: true },
  });

  const trimmedTitle = title.slice(0, MAX_JOURNAL_TITLE_LENGTH);

  const entry = await db.$transaction(async (tx) => {
    const createdEntry = await tx.entry.create({
      data: {
        organizationId: scope.organizationId,
        type: EntryType.JOURNAL,
        title: trimmedTitle,
        content,
        visibility,
        status: EntryStatus.OPEN,
        priority: "MEDIUM",
        createdByPersonId: scope.auth.personId,
        updatedByPersonId: scope.auth.personId,
        teamId: primaryRosterMembership?.teamId ?? null,
        journalPromptId,
        journalAssignmentId,
      },
      select: { id: true, version: true, status: true, visibility: true, title: true, content: true },
    });

    await tx.journalVersion.create({
      data: buildJournalVersionSnapshotCreateInput({
        organizationId: scope.organizationId,
        entryId: createdEntry.id,
        versionNumber: createdEntry.version,
        changeType: JournalVersionChangeType.DRAFT_CREATED,
        title: createdEntry.title,
        content: createdEntry.content,
        visibility: createdEntry.visibility,
        status: createdEntry.status,
        fromStatus: null,
        toStatus: EntryStatus.OPEN,
        capturedByPersonId: scope.auth.personId,
        changeReason: "Initial journal draft created.",
      }),
    });

    return createdEntry;
  });

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_DRAFT_CREATED,
    // Never store journal body/title content in activity metadata.
    metadata: { visibility, hasPrompt: Boolean(journalPromptId) },
  });

  return NextResponse.redirect(new URL(`/journals/${entry.id}`, request.url), 303);
}
