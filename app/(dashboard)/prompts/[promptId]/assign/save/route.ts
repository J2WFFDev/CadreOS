import { JournalAssignmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import { canAssignPrompt } from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";

function parseDateParam(rawValue: string): Date | null {
  if (!rawValue.trim()) return null;
  const parsed = new Date(rawValue.trim());
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ promptId: string }> },
) {
  const { promptId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/prompts", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canAssignPrompt(accessContext)) {
    return NextResponse.redirect(new URL(`/prompts/${promptId}`, request.url), 303);
  }

  const prompt = await db.journalPrompt.findFirst({
    where: { id: promptId, organizationId: scope.organizationId, active: true },
    select: { id: true },
  });

  if (!prompt) {
    return NextResponse.redirect(new URL(`/prompts/${promptId}`, request.url), 303);
  }

  const formData = await request.formData();
  const athletePersonId = String(formData.get("athletePersonId") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const dueAt = parseDateParam(String(formData.get("dueAt") ?? ""));
  const scheduledFor = parseDateParam(String(formData.get("scheduledFor") ?? ""));

  // Must target at least one recipient
  if (!athletePersonId && !teamId) {
    return NextResponse.redirect(
      new URL(`/prompts/${promptId}/assign`, request.url),
      303,
    );
  }

  // Verify athlete belongs to the organization if specified
  if (athletePersonId) {
    const athlete = await db.person.findFirst({
      where: { id: athletePersonId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.redirect(
        new URL(`/prompts/${promptId}/assign`, request.url),
        303,
      );
    }
  }

  // Verify team belongs to the organization if specified
  if (teamId) {
    const team = await db.team.findFirst({
      where: { id: teamId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.redirect(
        new URL(`/prompts/${promptId}/assign`, request.url),
        303,
      );
    }
  }

  const initialStatus =
    scheduledFor && scheduledFor.getTime() > Date.now()
      ? JournalAssignmentStatus.PENDING
      : JournalAssignmentStatus.ACTIVE;

  const assignment = await db.journalAssignment.create({
    data: {
      organizationId: scope.organizationId,
      promptId,
      assignedToAthletePersonId: athletePersonId,
      assignedToTeamId: teamId,
      assignedByPersonId: scope.auth.personId,
      scheduledFor,
      dueAt,
      status: initialStatus,
    },
    select: { id: true },
  });

  // Write safe activity — no journal body text in payload
  // The metadataJson stores only safe metadata references, never journal content.
  const metadataRef = {
    assignmentId: assignment.id,
    promptId,
    targetAthletePersonId: athletePersonId,
    targetTeamId: teamId,
    dueAt: dueAt?.toISOString() ?? null,
    status: initialStatus,
  };

  // Activity is anchored to a synthetic "assignment stub" — we write it to
  // the organization's activity stream via an Entry created for this purpose.
  // Since JournalAssignment is not an Entry, we emit the activity at the
  // organization-level without an entryId by using a freestanding log approach.
  // For now, we skip writing an EntryActivity (requires an Entry anchor)
  // and rely on prompt detail page assignment list for visibility.
  // Arc 23E will wire feed-level journal assignment activity when entry
  // anchoring is formalized.
  void metadataRef;

  return NextResponse.redirect(new URL(`/prompts/${promptId}`, request.url), 303);
}
