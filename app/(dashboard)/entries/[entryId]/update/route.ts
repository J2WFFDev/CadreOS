import { EntryPriority, EntryStatus, EntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  createEmptyDecisionEntryPayload,
  normalizeDecisionClassification,
  normalizeDecisionDateOnly,
  normalizeDecisionMaturityResult,
  parseDecisionEntryPayload,
  parseDecisionParticipantNames,
  serializeDecisionEntryPayload,
} from "@/lib/entries/decision-payload";
import {
  DEFAULT_EVENT_TIMEZONE,
  createEmptyEventEntryPayload,
  normalizeDateOnly,
  normalizeEventCalendarScope,
  normalizeEventRecurrenceEnd,
  normalizeEventRecurrenceFrequency,
  normalizeEventTimezone,
  normalizeEventType,
  parseEventEntryPayload,
  serializeEventEntryPayload,
} from "@/lib/entries/event-payload";
import {
  createEmptyJournalEntryPayload,
  mapJournalPayloadVisibilityToEntryVisibility,
  normalizeJournalDateOnly,
  normalizeJournalPayloadVisibility,
  parseJournalEntryPayload,
  serializeJournalEntryPayload,
} from "@/lib/entries/journal-payload";
import { resolveOrCreateEntryDefaultInboxList } from "@/lib/entries/lists";
import {
  ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE,
  logEntryTypePayloadSchemaIssue,
} from "@/lib/entries/schema-guard";
import { USER_SELECTABLE_ENTRY_TYPES } from "@/lib/entries/user-selectable-types";
import { resolveEntryOpsEntryActionVisibilityWhere } from "@/lib/entryops/visibility";
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

const EVENT_FORM_FIELDS = [
  "eventType",
  "eventStartDateTime",
  "eventEndDateTime",
  "eventTimezone",
  "eventLocation",
  "eventCalendarScope",
  "eventProgramId",
  "eventTeamId",
  "eventRecurrenceFrequency",
  "eventRecurrenceInterval",
  "eventRecurrenceCustomRule",
  "eventRecurrenceEndCondition",
  "eventRecurrenceEndDate",
  "eventRecurrenceOccurrenceCount",
] as const;

// Arc 24D.7: journal metadata form fields
const JOURNAL_FORM_FIELDS = [
  "journalVisibility",
  "journalDate",
  "journalAuthor",
] as const;

const EVENT_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE =
  "Event metadata is temporarily unavailable until setup is complete.";

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function normalizeDateTimeLocal(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATETIME_LOCAL_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeOptionalId(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInteger(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toEntryDateValue(dateTimeLocal: string | null) {
  if (!dateTimeLocal) return null;
  // Entry.startDate/endDate are date-only fields; keep only the local calendar date at UTC midnight.
  const datePart = dateTimeLocal.slice(0, 10);
  return new Date(`${datePart}T00:00:00.000Z`);
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
  const entryVisibilityWhere = await resolveEntryOpsEntryActionVisibilityWhere({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

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
  // Arc 24D.8X-C: list assignment — empty string means "assign default Inbox", absent means "no change"
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
  const rawDecisionClassification = String(formData.get("decisionClassification") ?? "").trim();
  const rawDecisionDate = String(formData.get("decisionDate") ?? "").trim();
  const rawMaturityDate = String(formData.get("maturityDate") ?? "").trim();
  const rawMaturityResult = String(formData.get("maturityResult") ?? "").trim();
  const rawMaturityReviewNotes = String(formData.get("maturityReviewNotes") ?? "").trim();
  const hasEventFormFields = EVENT_FORM_FIELDS.some((fieldName) => formData.has(fieldName));
  const rawEventType = String(formData.get("eventType") ?? "").trim();
  const rawEventStartDateTime = String(formData.get("eventStartDateTime") ?? "").trim();
  const rawEventEndDateTime = String(formData.get("eventEndDateTime") ?? "").trim();
  const rawEventTimezone = String(formData.get("eventTimezone") ?? "").trim();
  const rawEventLocation = String(formData.get("eventLocation") ?? "").trim();
  const rawEventCalendarScope = String(formData.get("eventCalendarScope") ?? "").trim();
  const rawEventProgramId = String(formData.get("eventProgramId") ?? "").trim();
  const rawEventTeamId = String(formData.get("eventTeamId") ?? "").trim();
  const rawEventRecurrenceFrequency = String(formData.get("eventRecurrenceFrequency") ?? "").trim();
  const rawEventRecurrenceInterval = String(formData.get("eventRecurrenceInterval") ?? "").trim();
  const rawEventRecurrenceCustomRule = String(formData.get("eventRecurrenceCustomRule") ?? "").trim();
  const rawEventRecurrenceEndCondition = String(formData.get("eventRecurrenceEndCondition") ?? "").trim();
  const rawEventRecurrenceEndDate = String(formData.get("eventRecurrenceEndDate") ?? "").trim();
  const rawEventRecurrenceOccurrenceCount = String(formData.get("eventRecurrenceOccurrenceCount") ?? "").trim();

  // Arc 24D.7: journal payload form fields
  const hasJournalFormFields = JOURNAL_FORM_FIELDS.some((fieldName) => formData.has(fieldName));
  const rawJournalVisibility = String(formData.get("journalVisibility") ?? "PRIVATE").trim();
  const rawJournalDate = String(formData.get("journalDate") ?? "").trim();
  const rawJournalAuthor = String(formData.get("journalAuthor") ?? "").trim();

  try {
    const entry = await db.entry.findFirst({
      where: { id: entryId, organizationId: organizationId, deletedAt: null, AND: [entryVisibilityWhere] },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        status: true,
        priority: true,
        teamId: true,
        startDate: true,
        endDate: true,
        timezone: true,
        sourceTaskId: true,
        sourceNoteId: true,
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

    // Arc 24D.5.1: Fetch Decision payload separately so a missing EntryTypePayload table
    // does not prevent the base entry lookup above from succeeding.
    let decisionPayloadRecord: { id: string; payloadJson: string } | null = null;
    let eventPayloadRecord: { id: string; payloadJson: string } | null = null;
    let journalPayloadRecord: { id: string; payloadJson: string } | null = null;
    let decisionPayloadUnavailable = false;
    try {
      const payloadRows = await db.entryTypePayload.findMany({
        where: { entryId: entry.id, entryType: { in: [EntryType.DECISION, EntryType.EVENT, EntryType.JOURNAL] } },
        select: { id: true, payloadJson: true, entryType: true },
      });
      decisionPayloadRecord = payloadRows.find((item) => item.entryType === EntryType.DECISION) ?? null;
      eventPayloadRecord = payloadRows.find((item) => item.entryType === EntryType.EVENT) ?? null;
      journalPayloadRecord = payloadRows.find((item) => item.entryType === EntryType.JOURNAL) ?? null;
    } catch (error) {
      const issue = logEntryTypePayloadSchemaIssue("entries.update.fetch-payload", error, {
        entryId: entry.id,
        organizationId,
      });
      if (issue) {
        decisionPayloadUnavailable = true;
      } else {
        throw error;
      }
    }

    const existingDecisionPayload = parseDecisionEntryPayload(decisionPayloadRecord?.payloadJson);
    const existingEventPayload = parseEventEntryPayload(eventPayloadRecord?.payloadJson);
    const existingJournalPayload = parseJournalEntryPayload(journalPayloadRecord?.payloadJson ?? null);

    // Arc 24D.7: Final journal locking guard.
    // A Final (DONE) journal's title, content, and journal payload fields may not be edited
    // via the entry update route. Status changes (e.g. ARCHIVED) and type conversions are allowed.
    if (entry.type === EntryType.JOURNAL && entry.status === EntryStatus.DONE) {
      const isContentChange = (title && title !== entry.title) || (content.length > 0 && content !== (entry.content ?? ""));
      const isPayloadChange = hasJournalFormFields;
      // Allow type conversion away from JOURNAL, status changes, and list assignment. Block content/payload edits.
      if (isContentChange || isPayloadChange) {
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "Final journals are locked. Reopen the journal before editing content or metadata.");
        return NextResponse.redirect(url, 303);
      }
    }

    // Arc 24D.4: Validate listId belongs to this org before writing.
    let resolvedListId: string | null | undefined;
    if (rawListId !== undefined) {
      if (rawListId === "") {
        const defaultList = await resolveOrCreateEntryDefaultInboxList({
          organizationId,
          actorPersonId: scope.auth.personId,
          teamId: entry.teamId,
        });
        resolvedListId = defaultList.id;
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

    const requestedCalendarScope = normalizeEventCalendarScope(rawEventCalendarScope) ?? existingEventPayload.calendarScope;
    const requestedProgramId = normalizeOptionalId(rawEventProgramId);
    const requestedTeamId = normalizeOptionalId(rawEventTeamId);
    const requestedRecurrenceEndCondition =
      normalizeEventRecurrenceEnd(rawEventRecurrenceEndCondition) ?? existingEventPayload.recurrence.endCondition;
    const requestedRecurrenceEndDate = normalizeDateOnly(rawEventRecurrenceEndDate);
    const requestedRecurrenceOccurrenceCount = normalizePositiveInteger(rawEventRecurrenceOccurrenceCount);

    if (hasEventFormFields) {
      if (requestedCalendarScope === "PROGRAM" && !requestedProgramId) {
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "Program scope requires selecting a program.");
        return NextResponse.redirect(url, 303);
      }

      if (requestedCalendarScope === "TEAM" && !requestedTeamId) {
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "Team scope requires selecting a team.");
        return NextResponse.redirect(url, 303);
      }

      if (requestedRecurrenceEndCondition === "ON_DATE" && !requestedRecurrenceEndDate) {
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "Recurrence end date is required when 'On date' is selected.");
        return NextResponse.redirect(url, 303);
      }

      if (requestedRecurrenceEndCondition === "AFTER_OCCURRENCES" && !requestedRecurrenceOccurrenceCount) {
        const url = new URL(returnTo, request.url);
        url.searchParams.set("error", "Recurrence occurrence count is required when 'After N occurrences' is selected.");
        return NextResponse.redirect(url, 303);
      }

      if (requestedProgramId) {
        const program = await db.program.findFirst({
          where: { id: requestedProgramId, organizationId },
          select: { id: true },
        });
        if (!program) {
          const url = new URL(returnTo, request.url);
          url.searchParams.set("error", "The selected program is not available.");
          return NextResponse.redirect(url, 303);
        }
      }

      if (requestedTeamId) {
        const team = await db.team.findFirst({
          where: { id: requestedTeamId, organizationId },
          select: { id: true },
        });
        if (!team) {
          const url = new URL(returnTo, request.url);
          url.searchParams.set("error", "The selected team is not available.");
          return NextResponse.redirect(url, 303);
        }
      }
    }

    const normalizedEventStartDateTime = normalizeDateTimeLocal(rawEventStartDateTime);
    const normalizedEventEndDateTime = normalizeDateTimeLocal(rawEventEndDateTime);
    const normalizedEventTimezone =
      normalizeEventTimezone(rawEventTimezone) ??
      normalizeEventTimezone(existingEventPayload.timezone) ??
      normalizeEventTimezone(entry.timezone) ??
      DEFAULT_EVENT_TIMEZONE;
    const eventDateUpdate =
      hasEventFormFields || nextEntryType === EntryType.EVENT
        ? {
            startDate: toEntryDateValue(normalizedEventStartDateTime),
            endDate: toEntryDateValue(normalizedEventEndDateTime),
            timezone: normalizedEventTimezone || null,
          }
        : undefined;

    const updateData = {
      ...(title ? { title } : {}),
      ...(content.length > 0 ? { content } : {}),
      ...(type ? { type } : {}),
      ...(status
        ? { status, taskCompleted: status === EntryStatus.DONE, completedAt: status === EntryStatus.DONE ? new Date() : null }
        : {}),
      ...(priority ? { priority } : {}),
      ...(dueDateUpdate !== undefined ? dueDateUpdate : {}),
      ...(eventDateUpdate !== undefined ? eventDateUpdate : {}),
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
      if (decisionPayloadUnavailable) {
        // Base entry type change was saved. Decision structured fields require the
        // EntryTypePayload migration to be applied before they can be written.
        console.warn("[entries.update] Decision payload write skipped: EntryTypePayload schema unavailable", {
          organizationId,
          entryId: entry.id,
        });
        revalidatePath(`/entries/${entryId}`);
        const warnUrl = new URL(returnTo, request.url);
        warnUrl.searchParams.set("saved", "1");
        warnUrl.searchParams.set("warning", ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE);
        return NextResponse.redirect(warnUrl, 303);
      }

      const payload =
        decisionPayloadRecord && !hasDecisionFormFields ? existingDecisionPayload : createEmptyDecisionEntryPayload();

      const fallbackDecisionStatement = (title.length > 0 ? title : entry.title).trim() || "Untitled decision";
      const fallbackDecisionDetails = content || entry.content || "";

      if (hasDecisionFormFields) {
        payload.decisionStatement = rawDecisionStatement;
        payload.decisionDetails = rawDecisionDetails;
      } else if (!decisionPayloadRecord) {
        payload.decisionStatement = fallbackDecisionStatement;
        payload.decisionDetails = fallbackDecisionDetails;
      }

      if (hasDecisionFormFields) {
        payload.decisionMaker = rawDecisionMaker;
        payload.supporters = parseDecisionParticipantNames(rawSupporters);
        payload.opposition = parseDecisionParticipantNames(rawOpposition);
        payload.classification = normalizeDecisionClassification(rawDecisionClassification);
        payload.decisionDate = normalizeDecisionDateOnly(rawDecisionDate);
        payload.maturityDate = normalizeDecisionDateOnly(rawMaturityDate);
        payload.maturityResult = normalizeDecisionMaturityResult(rawMaturityResult);
        payload.maturityReviewNotes = rawMaturityReviewNotes;
      }

      try {
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
      } catch (error) {
        const issue = logEntryTypePayloadSchemaIssue("entries.update.upsert-payload", error, {
          entryId: entry.id,
          organizationId,
        });
        if (issue) {
          // Base entry was saved. Redirect with warning rather than failing the whole save.
          revalidatePath(`/entries/${entryId}`);
          const warnUrl = new URL(returnTo, request.url);
          warnUrl.searchParams.set("saved", "1");
          warnUrl.searchParams.set("warning", ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE);
          return NextResponse.redirect(warnUrl, 303);
        }
        throw error;
      }

      try {
        await db.entryTypePayload.updateMany({
          where: {
            organizationId,
            entryId: entry.id,
            entryType: EntryType.EVENT,
            isActive: true,
          },
          data: {
            isActive: false,
            archivedAt: new Date(),
          },
        });
      } catch (error) {
        const issue = logEntryTypePayloadSchemaIssue("entries.update.archive-event-payload", error, {
          entryId: entry.id,
          organizationId,
        });
        if (!issue) {
          throw error;
        }
      }
    } else if (nextEntryType === EntryType.EVENT) {
      if (decisionPayloadUnavailable) {
        console.warn("[entries.update] Event payload write skipped: EntryTypePayload schema unavailable", {
          organizationId,
          entryId: entry.id,
        });
        revalidatePath(`/entries/${entryId}`);
        const warnUrl = new URL(returnTo, request.url);
        warnUrl.searchParams.set("saved", "1");
        warnUrl.searchParams.set("warning", EVENT_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE);
        return NextResponse.redirect(warnUrl, 303);
      }

      const payload =
        eventPayloadRecord && !hasEventFormFields ? existingEventPayload : createEmptyEventEntryPayload();

      if (hasEventFormFields) {
        payload.eventType = normalizeEventType(rawEventType) ?? "OTHER";
        payload.startDateTimeLocal = normalizedEventStartDateTime;
        payload.endDateTimeLocal = normalizedEventEndDateTime;
        payload.timezone = normalizedEventTimezone;
        payload.location = rawEventLocation;
        payload.calendarScope = requestedCalendarScope;
        payload.programId = requestedProgramId;
        payload.teamId = requestedTeamId;
        payload.recurrence.frequency = normalizeEventRecurrenceFrequency(rawEventRecurrenceFrequency) ?? "NONE";
        payload.recurrence.interval = normalizePositiveInteger(rawEventRecurrenceInterval);
        payload.recurrence.customRule = rawEventRecurrenceCustomRule;
        payload.recurrence.endCondition = requestedRecurrenceEndCondition;
        payload.recurrence.endDate = requestedRecurrenceEndDate;
        payload.recurrence.occurrenceCount = requestedRecurrenceOccurrenceCount;
      } else if (!eventPayloadRecord) {
        payload.timezone = normalizeEventTimezone(entry.timezone) ?? DEFAULT_EVENT_TIMEZONE;
      }

      if (payload.calendarScope !== "PROGRAM") {
        payload.programId = null;
      }
      if (payload.calendarScope !== "TEAM") {
        payload.teamId = null;
      }
      if (payload.recurrence.endCondition !== "ON_DATE") {
        payload.recurrence.endDate = null;
      }
      if (payload.recurrence.endCondition !== "AFTER_OCCURRENCES") {
        payload.recurrence.occurrenceCount = null;
      }
      if (payload.recurrence.frequency !== "CUSTOM") {
        payload.recurrence.customRule = "";
      }

      try {
        await db.entryTypePayload.upsert({
          where: {
            entryId_entryType: {
              entryId: entry.id,
              entryType: EntryType.EVENT,
            },
          },
          create: {
            organizationId,
            entryId: entry.id,
            entryType: EntryType.EVENT,
            payloadJson: serializeEventEntryPayload(payload),
            isActive: true,
            archivedAt: null,
          },
          update: {
            payloadJson: serializeEventEntryPayload(payload),
            isActive: true,
            archivedAt: null,
          },
        });
      } catch (error) {
        const issue = logEntryTypePayloadSchemaIssue("entries.update.upsert-event-payload", error, {
          entryId: entry.id,
          organizationId,
        });
        if (issue) {
          revalidatePath(`/entries/${entryId}`);
          const warnUrl = new URL(returnTo, request.url);
          warnUrl.searchParams.set("saved", "1");
          warnUrl.searchParams.set("warning", EVENT_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE);
          return NextResponse.redirect(warnUrl, 303);
        }
        throw error;
      }

      try {
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
      } catch (error) {
        const issue = logEntryTypePayloadSchemaIssue("entries.update.archive-decision-payload", error, {
          entryId: entry.id,
          organizationId,
        });
        if (!issue) {
          throw error;
        }
      }
    } else if (nextEntryType === EntryType.JOURNAL) {
      // Arc 24D.7: upsert journal payload and archive DECISION/EVENT payloads.
      if (!decisionPayloadUnavailable) {
        const journalVisibility = normalizeJournalPayloadVisibility(rawJournalVisibility);
        const journalDate = normalizeJournalDateOnly(rawJournalDate);
        const entryVisibility = mapJournalPayloadVisibilityToEntryVisibility(journalVisibility);

        const journalPayload = hasJournalFormFields
          ? {
              ...existingJournalPayload,
              journalVisibility,
              journalDate,
              journalAuthor: rawJournalAuthor,
            }
          : journalPayloadRecord
            ? existingJournalPayload
            : { ...createEmptyJournalEntryPayload(), journalStatus: "DRAFT" as const };

        try {
          await db.entryTypePayload.upsert({
            where: { entryId_entryType: { entryId: entry.id, entryType: EntryType.JOURNAL } },
            create: {
              organizationId,
              entryId: entry.id,
              entryType: EntryType.JOURNAL,
              payloadJson: serializeJournalEntryPayload(journalPayload),
              isActive: true,
              archivedAt: null,
            },
            update: {
              payloadJson: serializeJournalEntryPayload(journalPayload),
              isActive: true,
              archivedAt: null,
            },
          });
        } catch (error) {
          const issue = logEntryTypePayloadSchemaIssue("entries.update.upsert-journal-payload", error, {
            entryId: entry.id,
            organizationId,
          });
          if (issue) {
            revalidatePath(`/entries/${entryId}`);
            const warnUrl = new URL(returnTo, request.url);
            warnUrl.searchParams.set("saved", "1");
            warnUrl.searchParams.set("warning", ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE);
            return NextResponse.redirect(warnUrl, 303);
          }
          throw error;
        }

        // Sync Entry.visibility with the journal payload's visibility setting
        if (hasJournalFormFields) {
          try {
            await db.entry.update({
              where: { id: entry.id },
              data: { visibility: entryVisibility },
              select: { id: true },
            });
          } catch {
            // Non-fatal: payload was saved; visibility sync is best-effort
          }
        }

        try {
          await db.entryTypePayload.updateMany({
            where: {
              organizationId,
              entryId: entry.id,
              entryType: { in: [EntryType.DECISION, EntryType.EVENT] },
              isActive: true,
            },
            data: { isActive: false, archivedAt: new Date() },
          });
        } catch (error) {
          const issue = logEntryTypePayloadSchemaIssue("entries.update.archive-non-journal-payloads", error, {
            entryId: entry.id,
            organizationId,
          });
          if (!issue) {
            throw error;
          }
        }
      }
    } else {
      // Non-Decision/Event/Journal: archive active type payloads. If EntryTypePayload table is
      // missing there is nothing to archive, so treat the error as non-fatal.
      if (!decisionPayloadUnavailable) {
        try {
          await db.entryTypePayload.updateMany({
            where: {
              organizationId,
              entryId: entry.id,
              entryType: { in: [EntryType.DECISION, EntryType.EVENT] },
              isActive: true,
            },
            data: {
              isActive: false,
              archivedAt: new Date(),
            },
          });
        } catch (error) {
          const issue = logEntryTypePayloadSchemaIssue("entries.update.archive-payload", error, {
            entryId: entry.id,
            organizationId,
          });
          if (!issue) {
            throw error;
          }
          // Table missing — nothing to archive, continue.
        }
      }
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
