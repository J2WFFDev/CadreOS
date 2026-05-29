import { EntryStatus, EntryType, EntryVisibility, JournalAssignmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { canCreateJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/lib/journals/policy";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

function normalizeJournalVisibility(rawValue: string): EntryVisibility {
  const normalized = rawValue.trim().toUpperCase();
  if (normalized === EntryVisibility.TEAM_STAFF) return EntryVisibility.TEAM_STAFF;
  if (normalized === EntryVisibility.ORGANIZATION_SCOPED) return EntryVisibility.ORGANIZATION_SCOPED;
  return EntryVisibility.STAFF_ONLY;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const visibility = normalizeJournalVisibility(String(formData.get("visibility") ?? EntryVisibility.STAFF_ONLY));
  const journalPromptId = String(formData.get("journalPromptId") ?? "").trim() || null;
  const journalAssignmentId = String(formData.get("journalAssignmentId") ?? "").trim() || null;

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

  if (!title || !content) {
    return NextResponse.redirect(new URL("/journals/create", request.url), 303);
  }

  try {
    if (journalPromptId) {
      const prompt = await db.journalPrompt.findFirst({
        where: { id: journalPromptId, organizationId: scope.organizationId, active: true },
        select: { id: true },
      });
      if (!prompt) {
        return NextResponse.redirect(new URL("/journals/create", request.url), 303);
      }
    }

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

    const entry = await db.entry.create({
      data: {
        organizationId: scope.organizationId,
        type: EntryType.JOURNAL,
        title: title.slice(0, MAX_JOURNAL_TITLE_LENGTH),
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
      select: { id: true },
    });

    try {
      await writeEntryActivity({
        organizationId: scope.organizationId,
        entryId: entry.id,
        actorPersonId: scope.auth.personId,
        action: ENTRY_ACTIVITY_ACTIONS.JOURNAL_DRAFT_CREATED,
        metadata: { visibility, hasPrompt: Boolean(journalPromptId) },
      });
    } catch (error) {
      console.error("[journals.create.save] Journal activity write failed", {
        organizationId: scope.organizationId,
        entryId: entry.id,
        error,
      });
    }

    return NextResponse.redirect(new URL(`/journals/${entry.id}`, request.url), 303);
  } catch (error) {
    const detail = describeSchemaUnavailableError(error);
    console.error("[journals.create.save] Journal persistence failed", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail: detail,
      error,
    });
    const redirect = new URL("/journals/create", request.url);
    redirect.searchParams.set(
      "error",
      isSchemaUnavailableError(error)
        ? `Journal creation is currently unavailable because ${detail ?? "required journal tables/columns are missing"}.`
        : "Unable to save journal draft right now. Please try again.",
    );
    return NextResponse.redirect(redirect, 303);
  }
}
