import { EntryPriority, EntryStatus, EntryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { mapEntryStatusToTaskStatus, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS, canWriteEntries } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

export async function POST(request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  const canEdit = await canWriteEntries({ organizationId, actorPersonId: scope.auth.personId });
  if (!canEdit) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "").trim().toUpperCase();
  const statusValue = String(formData.get("status") ?? "").trim().toUpperCase();
  const priorityValue = String(formData.get("priority") ?? "").trim().toUpperCase();
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
  const hasDueAtField = formData.has("dueAt");

  const type = Object.values(EntryType).includes(typeValue as EntryType) ? (typeValue as EntryType) : undefined;
  const status = Object.values(EntryStatus).includes(statusValue as EntryStatus) ? (statusValue as EntryStatus) : undefined;
  const priority = Object.values(EntryPriority).includes(priorityValue as EntryPriority)
    ? (priorityValue as EntryPriority)
    : undefined;

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

    if (!entry || entry.type === EntryType.JOURNAL) {
      return NextResponse.redirect(new URL(returnTo, request.url), 303);
    }

    await db.entry.update({
      where: { id: entry.id },
      data: {
        ...(title ? { title } : {}),
        ...(content.length > 0 ? { content } : {}),
        ...(type ? { type } : {}),
        ...(status
          ? { status, taskCompleted: status === EntryStatus.DONE, completedAt: status === EntryStatus.DONE ? new Date() : null }
          : {}),
        ...(priority ? { priority } : {}),
        ...(dueDateUpdate !== undefined ? dueDateUpdate : {}),
        version: { increment: 1 },
      },
    });

    if (entry.sourceTaskId && status) {
      const taskStatusUpdate = await db.followUpTask.updateMany({
        where: { id: entry.sourceTaskId, organizationId: organizationId },
        data: { status: mapEntryStatusToTaskStatus(status) },
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
      if (noteUpdate.count === 0) {
        console.warn("[entries.update] Linked note was not found while syncing content", {
          organizationId,
          entryId: entry.id,
          sourceNoteId: entry.sourceNoteId,
        });
      }
    }

    try {
      await writeEntryActivity({
        organizationId: organizationId,
        entryId: entry.id,
        actorPersonId: scope.auth.personId,
        action:
          status && status !== entry.status
            ? status === EntryStatus.DONE
              ? ENTRY_ACTIVITY_ACTIONS.ENTRY_COMPLETED
              : status === EntryStatus.ARCHIVED
                ? ENTRY_ACTIVITY_ACTIONS.ENTRY_ARCHIVED
                : ENTRY_ACTIVITY_ACTIONS.ENTRY_STATUS_CHANGED
            : ENTRY_ACTIVITY_ACTIONS.ENTRY_UPDATED,
        metadata: {
          changedType: type ?? null,
          fromStatus: status && status !== entry.status ? entry.status : null,
          toStatus: status && status !== entry.status ? status : null,
          changedPriority: priority ?? null,
        },
      });
    } catch (error) {
      console.error("[entries.update] Activity write failed", {
        organizationId,
        entryId: entry.id,
        error,
      });
    }
  } catch (error) {
    console.error("[entries.update] Failed to update entry", {
      organizationId,
      entryId,
      schemaDetail: describeSchemaUnavailableError(error),
      error,
    });
    if (isSchemaUnavailableError(error)) {
      const schemaDetail = describeSchemaUnavailableError(error);
      const url = new URL(returnTo, request.url);
      if (schemaDetail) {
        url.searchParams.set("error", `Entry update schema dependency unavailable: ${schemaDetail}.`);
      }
      return NextResponse.redirect(url, 303);
    }
  }

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
