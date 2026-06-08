import { EntryStatus, EntryType, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  entryActionDeniedMessage,
  ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE,
  logEntryOpsAccessDecision,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsDetailAccessDecision,
  resolveEntryOpsVisibilityContext,
  buildEntryOpsEntryDetailVisibilityWhere,
} from "@/lib/entryops/visibility";
import { writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/entries");

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;
  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  const entryVisibilityWhere = buildEntryOpsEntryDetailVisibilityWhere(entryVisibility);

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: organizationId, deletedAt: null, AND: [entryVisibilityWhere] },
    select: { id: true, sourceTaskId: true, type: true },
  });

  if (!entry || entry.type === EntryType.JOURNAL) {
    const existingEntry = !entry
      ? await db.entry.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          select: {
            createdByPersonId: true,
            assignedToPersonId: true,
            teamId: true,
            team: { select: { programId: true } },
            assignments: { select: { personId: true, revokedAt: true }, take: 40 },
          },
        })
      : null;
    logEntryOpsAccessDecision({
      workflow: "entries.archive",
      entryId,
      organizationId,
      actorPersonId: scope.auth.personId,
      decision: entry
        ? { allowed: false, reasonCode: "ENTRY_ACTION_DENIED" }
        : resolveEntryOpsDetailAccessDecision(visibilityContext, entryVisibility, existingEntry),
    });
    const url = new URL(`/entries/${entryId}`, request.url);
    url.searchParams.set("error", entry ? entryActionDeniedMessage("archive this work item") : ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE);
    return NextResponse.redirect(url, 303);
  }

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: organizationId,
      action: "entry.delete",
    });
  } catch {
    logEntryOpsAccessDecision({
      workflow: "entries.archive",
      entryId,
      organizationId,
      actorPersonId: scope.auth.personId,
      decision: { allowed: false, reasonCode: "ENTRY_ACTION_DENIED" },
    });
    const url = new URL(`/entries/${entryId}`, request.url);
    url.searchParams.set("error", entryActionDeniedMessage("archive this work item"));
    return NextResponse.redirect(url, 303);
  }

  await db.entry.update({
    where: { id: entry.id },
    data: { deletedAt: new Date(), status: EntryStatus.ARCHIVED, version: { increment: 1 } },
  });

  if (entry.sourceTaskId) {
    await db.followUpTask.update({
      where: { id: entry.sourceTaskId },
      data: { status: TaskStatus.CANCELLED },
    });
  }

  await writeEntryActivity({
    organizationId: organizationId,
    entryId: entry.id,
    actorPersonId: scope.auth.personId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ARCHIVED,
    metadata: { archivedAt: new Date().toISOString() },
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
