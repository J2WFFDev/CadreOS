import { EntryPriority, EntryStatus, EntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  DECISION_CLASSIFICATION_VALUES,
  DECISION_MATURITY_RESULT_VALUES,
  createEmptyDecisionEntryPayload,
  parseDecisionEntryPayload,
  parseDecisionParticipantNames,
  serializeDecisionEntryPayload,
} from "@/lib/entries/decision-payload";
import { USER_SELECTABLE_ENTRY_TYPES } from "@/lib/entries/user-selectable-types";
import { mapEntryStatusToTaskStatus, writeEntryActivity } from "@/lib/entries/service";
import { ENTRY_ACTIVITY_ACTIONS, canWriteEntries } from "@/lib/operational-entry";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

const DECISION_FORM_FIELDS = [
  "decisionStatement",
  "decisionDetails",
  "decisionMaker",
  "supporters",
  "opposition",
  "decisionClassification",
  "decisionDate",
  "maturityDate",
  "maturityResult",
  "maturityReviewNotes",
] as const;

function normalizeDateOnly(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

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
  // Arc 24D.4: list assignment — empty string means "clear list", absent means "no change"
  const rawListId = formData.has("listId") ? String(formData.get("listId") ?? "").trim() : undefined;

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

  const hasDecisionFormFields = DECISION_FORM_FIELDS.some((fieldName) => formData.has(fieldName));
  const rawDecisionStatement = String(formData.get("decisionStatement") ?? "").trim();
  const rawDecisionDetails = String(formData.get("decisionDetails") ?? "").trim();
  const rawDecisionMaker = String(formData.get("decisionMaker") ?? "").trim();
  const rawSupporters = String(formData.get("supporters") ?? "");
  const rawOpposition = String(formData.get("opposition") ?? "");
  const rawDecisionClassification = String(formData.get("decisionClassification") ?? "")
    .trim()
    .toUpperCase();
  const rawDecisionDate = String(formData.get("decisionDate") ?? "").trim();
  const rawMaturityDate = String(formData.get("maturityDate") ?? "").trim();
  const rawMaturityResult = String(formData.get("maturityResult") ?? "")
    .trim()
    .toUpperCase();
  const rawMaturityReviewNotes = String(formData.get("maturityReviewNotes") ?? "").trim();

  try {
    const entry = await db.entry.findFirst({
      where: { id: entryId, organizationId: organizationId, deletedAt: null },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        status: true,
        priority: true,
        sourceTaskId: true,
        sourceNoteId: true,
        typePayloads: {
          where: { entryType: EntryType.DECISION },
          select: { id: true, payloadJson: true },
          take: 1,
        },
      },
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
    // Allow an existing legacy/internal type to remain unchanged while blocking conversion into hidden types.
    let type: EntryType | undefined;
    if (requestedType) {
      const canUseRequestedType =
        USER_SELECTABLE_ENTRY_TYPES.includes(requestedType) || requestedType === entry.type;
      if (!canUseRequestedType) {
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "This entry type is not available for direct selection.");
        return NextResponse.redirect(url, 303);
      }
      type = requestedType;
    }
    const nextEntryType = type ?? entry.type;
    const decisionPayloadRecord = entry.typePayloads[0] ?? null;
    const existingDecisionPayload = parseDecisionEntryPayload(decisionPayloadRecord?.payloadJson);

    // Arc 24D.4: Validate listId belongs to this org before writing.
    let resolvedListId: string | null | undefined;
    if (rawListId !== undefined) {
      if (rawListId === "") {
        resolvedListId = null;
      } else {
        const listRecord = await db.entryList.findFirst({
          where: { id: rawListId, organizationId, isArchived: false },
          select: { id: true },
        });
        if (!listRecord) {
          const url = new URL(returnTo, request.url);
          url.searchParams.set("error", "The selected list is not available.");
          return NextResponse.redirect(url, 303);
        }
        resolvedListId = listRecord.id;
      }
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
      ...(resolvedListId !== undefined ? { listId: resolvedListId } : {}),
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

    if (nextEntryType === EntryType.DECISION) {
      const payload =
        decisionPayloadRecord && !hasDecisionFormFields ? existingDecisionPayload : createEmptyDecisionEntryPayload();

      if (hasDecisionFormFields || !decisionPayloadRecord) {
        payload.decisionStatement = hasDecisionFormFields
          ? rawDecisionStatement
          : (title || entry.title);
        payload.decisionDetails = hasDecisionFormFields
          ? rawDecisionDetails
          : (content.length > 0 ? content : (entry.content ?? ""));
      }

      if (hasDecisionFormFields) {
        payload.decisionMaker = rawDecisionMaker;
        payload.supporters = parseDecisionParticipantNames(rawSupporters);
        payload.opposition = parseDecisionParticipantNames(rawOpposition);
        payload.classification = DECISION_CLASSIFICATION_VALUES.includes(
          rawDecisionClassification as (typeof DECISION_CLASSIFICATION_VALUES)[number],
        )
          ? (rawDecisionClassification as (typeof DECISION_CLASSIFICATION_VALUES)[number])
          : null;
        payload.decisionDate = normalizeDateOnly(rawDecisionDate);
        payload.maturityDate = normalizeDateOnly(rawMaturityDate);
        payload.maturityResult = DECISION_MATURITY_RESULT_VALUES.includes(
          rawMaturityResult as (typeof DECISION_MATURITY_RESULT_VALUES)[number],
        )
          ? (rawMaturityResult as (typeof DECISION_MATURITY_RESULT_VALUES)[number])
          : null;
        payload.maturityReviewNotes = rawMaturityReviewNotes;
      }

      await db.entryTypePayload.upsert({
        where: {
          entryId_entryType: {
            entryId: entry.id,
            entryType: EntryType.DECISION,
          },
        },
        create: {
          organizationId,
          entryId: entry.id,
          entryType: EntryType.DECISION,
          payloadJson: serializeDecisionEntryPayload(payload),
          isActive: true,
          archivedAt: null,
        },
        update: {
          payloadJson: serializeDecisionEntryPayload(payload),
          isActive: true,
          archivedAt: null,
        },
      });
    } else {
      await db.entryTypePayload.updateMany({
        where: {
          organizationId,
          entryId: entry.id,
          entryType: EntryType.DECISION,
          isActive: true,
        },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      });
    }

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
          changedType: type && type !== entry.type ? type : null,
          fromStatus: status && status !== entry.status ? entry.status : null,
          toStatus: status && status !== entry.status ? status : null,
          changedPriority: priority && priority !== entry.priority ? priority : null,
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
