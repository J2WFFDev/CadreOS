import { EntryType, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  buildEntryOpsEntryDetailVisibilityWhere,
  canEditEntryOpsEntry,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsVisibilityContext,
} from "@/lib/entryops/visibility";
import { deriveTaskCompletionUpdate, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS, canWriteEntries } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  console.log("[entries.complete] POST received", { entryId });

  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  console.log("[entries.complete] scope resolved", {
    databaseReady: scope.databaseReady,
    organizationId: scope.organizationId,
    personId: scope.auth.personId,
    clerkUserId: scope.auth.clerkUserId,
    unresolvedPersonLink: scope.auth.unresolvedPersonLink,
    errorMessage: scope.errorMessage ?? null,
  });

  if (!scope.databaseReady || !scope.organizationId) {
    console.warn("[entries.complete] Aborting: database not ready or no organizationId", {
      databaseReady: scope.databaseReady,
      organizationId: scope.organizationId,
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", scope.errorMessage ?? "Database is not available.");
    return NextResponse.redirect(url, 303);
  }
  const organizationId = scope.organizationId;
  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  const entryVisibilityWhere = buildEntryOpsEntryDetailVisibilityWhere(entryVisibility);

  const canEditByRole = await canWriteEntries({ organizationId, actorPersonId: scope.auth.personId });
  console.log("[entries.complete] canWriteEntries result", {
    canEdit: canEditByRole,
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: organizationId, deletedAt: null, AND: [entryVisibilityWhere] },
    select: {
      id: true,
      type: true,
      taskCompleted: true,
      sourceTaskId: true,
      createdByPersonId: true,
      assignedToPersonId: true,
      teamId: true,
      assignments: {
        select: { personId: true, revokedAt: true },
        take: 40,
      },
    },
  });

  console.log("[entries.complete] entry lookup result", {
    found: Boolean(entry),
    entryType: entry?.type ?? null,
    taskCompleted: entry?.taskCompleted ?? null,
    sourceTaskId: entry?.sourceTaskId ?? null,
  });

  if (!entry || (entry.type !== EntryType.TASK && entry.type !== EntryType.FOLLOW_UP)) {
    console.warn("[entries.complete] Aborting: entry not found or wrong type", {
      entryId,
      organizationId,
      found: Boolean(entry),
      entryType: entry?.type ?? null,
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", !entry ? "Entry not found." : "Only TASK or FOLLOW_UP entries can be completed.");
    return NextResponse.redirect(url, 303);
  }

  const canEdit = canEditEntryOpsEntry({
    canWriteEntries: canEditByRole,
    context: visibilityContext,
    entry,
  });
  if (!canEdit) {
    console.warn("[entries.complete] Aborting: actor does not have entry completion permission", {
      organizationId,
      actorPersonId: scope.auth.personId,
      unresolvedPersonLink: scope.auth.unresolvedPersonLink,
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", "You do not have permission to complete this entry.");
    return NextResponse.redirect(url, 303);
  }

  if (entry.taskCompleted) {
    console.log("[entries.complete] Entry already completed, redirecting without changes");
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  try {
    const completedAt = new Date();
    const completionUpdate = deriveTaskCompletionUpdate(completedAt);

    console.log("[entries.complete] attempting db.entry.update with completion data", {
      entryId: entry.id,
      status: completionUpdate.status,
      taskCompleted: completionUpdate.taskCompleted,
    });

    await db.entry.update({
      where: { id: entry.id },
      data: {
        status: completionUpdate.status,
        taskCompleted: completionUpdate.taskCompleted,
        completedAt: completionUpdate.completedAt,
        ...(scope.auth.personId ? { updatedByPersonId: scope.auth.personId } : {}),
        version: { increment: 1 },
      },
      select: { id: true },
    });

    console.log("[entries.complete] db.entry.update succeeded");

    if (entry.sourceTaskId) {
      const taskUpdate = await db.followUpTask.updateMany({
        where: { id: entry.sourceTaskId, organizationId: organizationId },
        data: { status: TaskStatus.DONE },
      });
      console.log("[entries.complete] linked task completion sync", {
        sourceTaskId: entry.sourceTaskId,
        count: taskUpdate.count,
      });
      if (taskUpdate.count === 0) {
        console.warn("[entries.complete] Linked follow-up task was not found while syncing completion", {
          organizationId,
          entryId: entry.id,
          sourceTaskId: entry.sourceTaskId,
        });
      }
    }

    try {
      console.log("[entries.complete] writing activity record");

      await writeEntryActivity({
        organizationId: organizationId,
        entryId: entry.id,
        actorPersonId: scope.auth.personId,
        action: ENTRY_ACTIVITY_ACTIONS.ENTRY_COMPLETED,
        metadata: { completedAt: completedAt.toISOString(), entryType: entry.type },
      });

      if (entry.type === EntryType.FOLLOW_UP) {
        await writeEntryActivity({
          organizationId: organizationId,
          entryId: entry.id,
          actorPersonId: scope.auth.personId,
          action: ENTRY_ACTIVITY_ACTIONS.FOLLOW_UP_COMPLETED,
          metadata: { completedAt: completedAt.toISOString() },
        });
      }

      console.log("[entries.complete] activity record(s) written");
    } catch (error) {
      console.error("[entries.complete] Activity write failed (non-fatal)", {
        organizationId,
        entryId: entry.id,
        error,
      });
    }

    revalidatePath(`/entries/${entryId}`);
    console.log("[entries.complete] revalidatePath called, redirecting to", returnTo);

    const successUrl = new URL(returnTo, request.url);
    successUrl.searchParams.set("saved", "1");
    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    console.error("[entries.complete] Failed to complete task entry", {
      organizationId,
      entryId,
      schemaDetail: describeSchemaUnavailableError(error),
      error,
    });
    const url = new URL(returnTo, request.url);
    if (isSchemaUnavailableError(error)) {
      const schemaDetail = describeSchemaUnavailableError(error);
      url.searchParams.set("error", `Entry complete schema dependency unavailable: ${schemaDetail ?? "unknown"}.`);
    } else {
      url.searchParams.set("error", "Entry complete failed. Check server logs for details.");
    }
    return NextResponse.redirect(url, 303);
  }
}
