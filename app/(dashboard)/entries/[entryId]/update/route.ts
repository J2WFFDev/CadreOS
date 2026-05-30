import { EntryPriority, EntryStatus, EntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { mapEntryStatusToTaskStatus, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS, canWriteEntries } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

const USER_SELECTABLE_ENTRY_TYPES: EntryType[] = [
  EntryType.TASK,
  EntryType.NOTE,
  EntryType.EVENT,
  EntryType.DECISION,
  EntryType.HABIT,
  EntryType.JOURNAL,
];

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  console.log("[entries.update] POST received", { entryId });

  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  console.log("[entries.update] scope resolved", {
    databaseReady: scope.databaseReady,
    organizationId: scope.organizationId,
    personId: scope.auth.personId,
    clerkUserId: scope.auth.clerkUserId,
    unresolvedPersonLink: scope.auth.unresolvedPersonLink,
    errorMessage: scope.errorMessage ?? null,
  });

  if (!scope.databaseReady || !scope.organizationId) {
    console.warn("[entries.update] Aborting: database not ready or no organizationId", {
      databaseReady: scope.databaseReady,
      organizationId: scope.organizationId,
      errorMessage: scope.errorMessage ?? null,
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", scope.errorMessage ?? "Database is not available.");
    return NextResponse.redirect(url, 303);
  }
  const organizationId = scope.organizationId;

  const canEdit = await canWriteEntries({ organizationId, actorPersonId: scope.auth.personId });
  console.log("[entries.update] canWriteEntries result", {
    canEdit,
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canEdit) {
    console.warn("[entries.update] Aborting: actor does not have write permission", {
      organizationId,
      actorPersonId: scope.auth.personId,
      unresolvedPersonLink: scope.auth.unresolvedPersonLink,
    });
    const url = new URL(returnTo, request.url);
    url.searchParams.set("error", "You do not have permission to edit entries.");
    return NextResponse.redirect(url, 303);
  }

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "").trim().toUpperCase();
  const statusValue = String(formData.get("status") ?? "").trim().toUpperCase();
  const priorityValue = String(formData.get("priority") ?? "").trim().toUpperCase();
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
  const hasDueAtField = formData.has("dueAt");

  const requestedType = Object.values(EntryType).includes(typeValue as EntryType) ? (typeValue as EntryType) : undefined;
  const status = Object.values(EntryStatus).includes(statusValue as EntryStatus) ? (statusValue as EntryStatus) : undefined;
  const priority = Object.values(EntryPriority).includes(priorityValue as EntryPriority)
    ? (priorityValue as EntryPriority)
    : undefined;

  console.log("[entries.update] form fields parsed", {
    title: title || "(empty)",
    contentLength: content.length,
    requestedType,
    status,
    priority,
    hasDueAtField,
    dueAtRaw: dueAtRaw || "(empty)",
  });

  // Parse dueAt only when the field was submitted (TASK entries include it; NOTE entries do not).
  let dueDateUpdate: { dueDate: Date | null; dueTime: string | null } | undefined;
  if (hasDueAtField) {
    if (dueAtRaw.length >= 10) {
      const dateStr = dueAtRaw.slice(0, 10);
      const timeStr = dueAtRaw.length >= 16 ? dueAtRaw.slice(11, 16) : null;
      dueDateUpdate = { dueDate: new Date(`${dateStr}T00:00:00.000Z`), dueTime: timeStr };
    } else {
      dueDateUpdate = { dueDate: null, dueTime: null };
    }
  }

  try {
    const entry = await db.entry.findFirst({
      where: { id: entryId, organizationId: organizationId, deletedAt: null },
      select: { id: true, type: true, status: true, sourceTaskId: true, sourceNoteId: true },
    });

    console.log("[entries.update] entry lookup result", {
      found: Boolean(entry),
      entryType: entry?.type ?? null,
      entryStatus: entry?.status ?? null,
      sourceTaskId: entry?.sourceTaskId ?? null,
      sourceNoteId: entry?.sourceNoteId ?? null,
    });

    if (!entry) {
      console.warn("[entries.update] Aborting: entry not found", {
        entryId,
        organizationId,
        found: Boolean(entry),
      });
      const url = new URL(returnTo, request.url);
      url.searchParams.set("error", "Entry not found.");
      return NextResponse.redirect(url, 303);
    }

    const type =
      requestedType && (USER_SELECTABLE_ENTRY_TYPES.includes(requestedType) || requestedType === entry.type)
        ? requestedType
        : undefined;
    if (requestedType && !type) {
      const url = new URL(returnTo, request.url);
      url.searchParams.set("error", "This entry type is not available for direct selection.");
      return NextResponse.redirect(url, 303);
    }

    const updateData = {
      ...(title ? { title } : {}),
      ...(content.length > 0 ? { content } : {}),
      ...(type ? { type } : {}),
      ...(status
        ? { status, taskCompleted: status === EntryStatus.DONE, completedAt: status === EntryStatus.DONE ? new Date() : null }
        : {}),
      ...(priority ? { priority } : {}),
      ...(dueDateUpdate !== undefined ? dueDateUpdate : {}),
      ...(scope.auth.personId ? { updatedByPersonId: scope.auth.personId } : {}),
      version: { increment: 1 },
    };

    console.log("[entries.update] attempting db.entry.update", {
      entryId: entry.id,
      updateFields: Object.keys(updateData).filter((k) => k !== "version"),
    });

    await db.entry.update({
      where: { id: entry.id },
      data: updateData,
      select: { id: true },
    });

    console.log("[entries.update] db.entry.update succeeded");

    if (entry.sourceTaskId && status) {
      const taskStatusUpdate = await db.followUpTask.updateMany({
        where: { id: entry.sourceTaskId, organizationId: organizationId },
        data: { status: mapEntryStatusToTaskStatus(status) },
      });
      console.log("[entries.update] linked task status sync", {
        sourceTaskId: entry.sourceTaskId,
        count: taskStatusUpdate.count,
      });
      if (taskStatusUpdate.count === 0) {
        console.warn("[entries.update] Linked follow-up task was not found while syncing status", {
          organizationId,
          entryId: entry.id,
          sourceTaskId: entry.sourceTaskId,
        });
      }
    }

    if (entry.sourceTaskId && title) {
      const taskContentUpdate = await db.followUpTask.updateMany({
        where: { id: entry.sourceTaskId, organizationId: organizationId },
        data: { title, ...(content.length > 0 ? { description: content } : {}) },
      });
      console.log("[entries.update] linked task title/content sync", {
        sourceTaskId: entry.sourceTaskId,
        count: taskContentUpdate.count,
      });
      if (taskContentUpdate.count === 0) {
        console.warn("[entries.update] Linked follow-up task was not found while syncing title/content", {
          organizationId,
          entryId: entry.id,
          sourceTaskId: entry.sourceTaskId,
        });
      }
    }

    if (entry.sourceNoteId && (content.length > 0 || title.length > 0)) {
      const body = content.length > 0 ? content : title;
      const noteUpdate = await db.observationNote.updateMany({
        where: { id: entry.sourceNoteId, organizationId: organizationId },
        data: { body },
      });
      console.log("[entries.update] linked note content sync", {
        sourceNoteId: entry.sourceNoteId,
        count: noteUpdate.count,
      });
      if (noteUpdate.count === 0) {
        console.warn("[entries.update] Linked note was not found while syncing content", {
          organizationId,
          entryId: entry.id,
          sourceNoteId: entry.sourceNoteId,
        });
      }
    }

    try {
      const activityAction =
        status && status !== entry.status
          ? status === EntryStatus.DONE
            ? ENTRY_ACTIVITY_ACTIONS.ENTRY_COMPLETED
            : status === EntryStatus.ARCHIVED
              ? ENTRY_ACTIVITY_ACTIONS.ENTRY_ARCHIVED
              : ENTRY_ACTIVITY_ACTIONS.ENTRY_STATUS_CHANGED
          : ENTRY_ACTIVITY_ACTIONS.ENTRY_UPDATED;

      console.log("[entries.update] writing activity record", { action: activityAction });

      await writeEntryActivity({
        organizationId: organizationId,
        entryId: entry.id,
        actorPersonId: scope.auth.personId,
        action: activityAction,
        metadata: {
          changedType: type ?? null,
          fromStatus: status && status !== entry.status ? entry.status : null,
          toStatus: status && status !== entry.status ? status : null,
          changedPriority: priority ?? null,
        },
      });

      console.log("[entries.update] activity record written");
    } catch (error) {
      console.error("[entries.update] Activity write failed (non-fatal)", {
        organizationId,
        entryId: entry.id,
        error,
      });
    }

    revalidatePath(`/entries/${entryId}`);
    console.log("[entries.update] revalidatePath called, redirecting to", returnTo);

    const successUrl = new URL(returnTo, request.url);
    successUrl.searchParams.set("saved", "1");
    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    console.error("[entries.update] Failed to update entry", {
      organizationId,
      entryId,
      schemaDetail: describeSchemaUnavailableError(error),
      error,
    });
    const url = new URL(returnTo, request.url);
    if (isSchemaUnavailableError(error)) {
      const schemaDetail = describeSchemaUnavailableError(error);
      url.searchParams.set("error", `Entry update schema dependency unavailable: ${schemaDetail ?? "unknown"}.`);
    } else {
      url.searchParams.set("error", "Entry save failed. Check server logs for details.");
    }
    return NextResponse.redirect(url, 303);
  }
}
