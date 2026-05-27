import {
  EntryObjectLinkTargetType,
  EntryPriority,
  EntryStatus,
  EntryType,
  EntryVisibility,
  InboxItemStatus,
  NoteVisibility,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { mapEntryPriorityToInboxPriority, shouldRouteEntryToInbox } from "@/lib/entries/inbox";
import { parseQuickAddEntryInput } from "@/lib/entries/parser";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { linkOperationalRecords, mapEntryObjectLinkTargetToGraphNodeType } from "@/lib/operational-graph";
import { ENTRY_ACTIVITY_ACTIONS, createOperationalEntry, linkEntryToObject, writeEntryActivity } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";
import {
  getQuickCapturePreset,
  isQuickCaptureContextTargetType,
  normalizeQuickCapturePriority,
  resolveQuickCaptureDueDate,
  resolveQuickCaptureEntryType,
} from "@/lib/quick-capture";
import { resolveActorPersonId } from "@/lib/user-account";

type ContextTarget = { targetType: EntryObjectLinkTargetType; targetId: string };

function buildQuickCaptureRedirectUrl(input: {
  requestUrl: string;
  returnTo: string;
  values: {
    title: string;
    details: string;
    captureType: string;
    priority: string;
    dueShortcut: string;
    assigneePersonId: string;
    contextTargetType: string;
    contextTargetId: string;
  };
  error?: string;
  openQuickCapture?: boolean;
}) {
  const url = new URL(input.returnTo, input.requestUrl);
  if (input.openQuickCapture) {
    url.searchParams.set("quickCapture", "1");
  }

  url.searchParams.set("title", input.values.title);
  url.searchParams.set("details", input.values.details);
  url.searchParams.set("captureType", input.values.captureType);
  url.searchParams.set("priority", input.values.priority);
  url.searchParams.set("dueShortcut", input.values.dueShortcut);
  url.searchParams.set("assigneePersonId", input.values.assigneePersonId);
  url.searchParams.set("contextTargetType", input.values.contextTargetType);
  url.searchParams.set("contextTargetId", input.values.contextTargetId);

  if (input.error) {
    url.searchParams.set("quickCaptureError", input.error);
  }

  return url;
}

function defaultContextRelationshipType(targetType: EntryObjectLinkTargetType) {
  if (targetType === EntryObjectLinkTargetType.EVENT) return "OBSERVED_DURING" as const;
  if (targetType === EntryObjectLinkTargetType.RESOURCE_BOOKING) return "READINESS_FOR" as const;
  return "RELATED_TO" as const;
}

async function resolveContextTarget(input: {
  organizationId: string;
  rawTargetType: string;
  rawTargetId: string;
}): Promise<ContextTarget | null> {
  if (!isQuickCaptureContextTargetType(input.rawTargetType)) return null;
  if (!input.rawTargetId) return null;

  const targetType = EntryObjectLinkTargetType[input.rawTargetType];
  if (!targetType) return null;

  const exists =
    targetType === EntryObjectLinkTargetType.TEAM
      ? await db.team.findFirst({ where: { id: input.rawTargetId, organizationId: input.organizationId }, select: { id: true } })
      : targetType === EntryObjectLinkTargetType.EVENT
        ? await db.event.findFirst({ where: { id: input.rawTargetId, organizationId: input.organizationId }, select: { id: true } })
        : targetType === EntryObjectLinkTargetType.GEAR_ITEM
          ? await db.gearItem.findFirst({ where: { id: input.rawTargetId, organizationId: input.organizationId }, select: { id: true } })
          : targetType === EntryObjectLinkTargetType.PERSON
            ? await db.person.findFirst({ where: { id: input.rawTargetId, organizationId: input.organizationId }, select: { id: true } })
            : targetType === EntryObjectLinkTargetType.RESOURCE_BOOKING
              ? await db.resourceBooking.findFirst({ where: { id: input.rawTargetId, organizationId: input.organizationId }, select: { id: true } })
              : null;

  if (!exists) return null;
  return { targetType, targetId: input.rawTargetId };
}

function mergeDueAt(dueDate: Date | null, dueTime: string | null) {
  if (!dueDate) return null;
  if (!dueTime) return dueDate;

  const [hours, minutes] = dueTime.split(":").map((value) => Number.parseInt(value, 10));
  return new Date(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate(), Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes),
  );
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const rawInput = String(formData.get("input") ?? "").trim();
  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawDetails = String(formData.get("details") ?? "").trim();
  const combinedInput = [rawTitle, rawDetails].filter(Boolean).join(" ").trim();
  const effectiveInput = rawInput || combinedInput;
  const captureType = String(formData.get("captureType") ?? "").trim().toUpperCase();
  const rawType = String(formData.get("entryType") ?? "AUTO").trim().toUpperCase();
  const rawPriority = String(formData.get("priority") ?? "").trim().toUpperCase();
  const rawDueShortcut = String(formData.get("dueShortcut") ?? "").trim().toUpperCase();
  const rawAssigneePersonId = String(formData.get("assigneePersonId") ?? "").trim();
  const rawContextTargetType = String(formData.get("contextTargetType") ?? "").trim().toUpperCase();
  const rawContextTargetId = String(formData.get("contextTargetId") ?? "").trim();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/dashboard");
  const redirectValues = {
    title: rawTitle,
    details: rawDetails,
    captureType,
    priority: rawPriority,
    dueShortcut: rawDueShortcut,
    assigneePersonId: rawAssigneePersonId,
    contextTargetType: rawContextTargetType,
    contextTargetId: rawContextTargetId,
  };

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(
      buildQuickCaptureRedirectUrl({
        requestUrl: request.url,
        returnTo,
        values: redirectValues,
        error: scope.errorMessage ?? "Unable to capture right now.",
        openQuickCapture: true,
      }),
      303,
    );
  }

  if (!effectiveInput) {
    return NextResponse.redirect(
      buildQuickCaptureRedirectUrl({
        requestUrl: request.url,
        returnTo,
        values: redirectValues,
        error: "Enter a title or details to capture this entry.",
        openQuickCapture: true,
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const actorPersonId = await resolveActorPersonId({
    organizationId: organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  if (!actorPersonId) {
    return NextResponse.redirect(
      buildQuickCaptureRedirectUrl({
        requestUrl: request.url,
        returnTo,
        values: redirectValues,
        error: "No linked organization person is available for entry attribution.",
        openQuickCapture: true,
      }),
      303,
    );
  }

  const parsed = parseQuickAddEntryInput(effectiveInput);
  const resolvedType = resolveQuickCaptureEntryType({
    captureType,
    legacyEntryType: rawType,
    inferredType: parsed.inferredType,
  });
  const entryType = EntryType[resolvedType];
  if (!entryType) {
    return NextResponse.redirect(
      buildQuickCaptureRedirectUrl({
        requestUrl: request.url,
        returnTo,
        values: redirectValues,
        error: "Select a valid capture type.",
        openQuickCapture: true,
      }),
      303,
    );
  }

  const quickCapturePreset = getQuickCapturePreset(captureType);
  const dueDateFromShortcut = resolveQuickCaptureDueDate(rawDueShortcut);
  const dueDate = dueDateFromShortcut ?? parsed.dueDate;
  const dueTime = dueDateFromShortcut ? null : parsed.dueTime;
  const priority = normalizeQuickCapturePriority(rawPriority, parsed.priority);
  const content = rawDetails || parsed.content;
  const title = rawTitle || parsed.title;
  const tags = Array.from(new Set([...parsed.tags, ...(quickCapturePreset?.defaultTags ?? [])]));
  const dueAt = mergeDueAt(dueDate, dueTime);

  const contextTarget = await resolveContextTarget({
    organizationId: organizationId,
    rawTargetType: rawContextTargetType,
    rawTargetId: rawContextTargetId,
  });

  const scopedTeamId = contextTarget?.targetType === EntryObjectLinkTargetType.TEAM ? contextTarget.targetId : null;
  const scopedEventId = contextTarget?.targetType === EntryObjectLinkTargetType.EVENT ? contextTarget.targetId : null;

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: organizationId,
      action: entryType === EntryType.TASK ? "task.create" : entryType === EntryType.NOTE ? "note.create" : "entry.create",
      teamId: scopedTeamId,
      eventId: scopedEventId,
    });
  } catch {
    return NextResponse.redirect(
      buildQuickCaptureRedirectUrl({
        requestUrl: request.url,
        returnTo,
        values: redirectValues,
        error: "You do not have permission to create this entry.",
        openQuickCapture: true,
      }),
      303,
    );
  }

  const resolvedAssigneePersonId = rawAssigneePersonId
    ? (
        await db.person.findFirst({
          where: { id: rawAssigneePersonId, organizationId: organizationId },
          select: { id: true },
        })
      )?.id ?? null
    : null;
  const assignedToPersonId = resolvedAssigneePersonId ?? actorPersonId;
  const inboxPriority = mapEntryPriorityToInboxPriority(EntryPriority[priority]);
  const shouldCreateInboxRoutingItem = shouldRouteEntryToInbox({
    entryType,
    dueDate,
    contextTargetId: contextTarget?.targetId ?? null,
  });
  const quickAddAction =
    entryType === EntryType.TASK
      ? ENTRY_ACTIVITY_ACTIONS.ENTRY_QUICK_ADD_TASK
      : entryType === EntryType.NOTE
        ? ENTRY_ACTIVITY_ACTIONS.ENTRY_QUICK_ADD_NOTE
        : ENTRY_ACTIVITY_ACTIONS.ENTRY_QUICK_ADD_GENERIC;

  try {
    if (entryType === EntryType.TASK) {
      const createdTask = await db.followUpTask.create({
      data: {
        organizationId: organizationId,
        title,
        description: content,
        status: TaskStatus.OPEN,
        assigneePersonId: assignedToPersonId,
        createdByPersonId: actorPersonId,
        dueAt,
      },
      select: { id: true },
    });

    const createdEntry = await createOperationalEntry({
      organizationId: organizationId,
      type: EntryType.TASK,
      title,
      content,
      tags,
      createdByPersonId: actorPersonId,
      assignedToPersonId,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: EntryPriority[priority],
      dueDate,
      dueTime,
      timezone: "UTC",
      taskRecurrenceRule: parsed.recurrenceRule,
      sourceTaskId: createdTask.id,
    });

    await writeEntryActivity({
      organizationId: organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: quickAddAction,
      metadata: { inferredType: parsed.inferredType, captureType, sourceTaskId: createdTask.id, assignedToPersonId },
    });
    if (assignedToPersonId) {
      await writeEntryActivity({
        organizationId: organizationId,
        entryId: createdEntry.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED,
        metadata: { personId: assignedToPersonId, role: "OWNER", source: "quick_add" },
      });
    }

    if (contextTarget) {
      await linkEntryToObject({
        organizationId: organizationId,
        entryId: createdEntry.id,
        targetType: contextTarget.targetType,
        targetId: contextTarget.targetId,
        createdByPersonId: actorPersonId,
      });

      await linkOperationalRecords({
        organizationId: organizationId,
        from: { nodeType: "ENTRY", nodeId: createdEntry.id },
        to: { nodeType: mapEntryObjectLinkTargetToGraphNodeType(contextTarget.targetType), nodeId: contextTarget.targetId },
        relationshipType: defaultContextRelationshipType(contextTarget.targetType),
        createdByPersonId: actorPersonId,
      });
    }

    if (shouldCreateInboxRoutingItem) {
      await db.inboxRoutingItem.create({
        data: {
          organizationId: organizationId,
          category: "ENTRY_CAPTURE",
          subjectRefType: "ENTRY",
          subjectRefId: createdEntry.id,
          priority: inboxPriority,
          status: InboxItemStatus.OPEN,
          ownerPersonId: assignedToPersonId,
          createdByPersonId: actorPersonId,
        },
      });
    }

      return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
    }

    if (entryType === EntryType.NOTE) {
      const createdNote = await db.observationNote.create({
      data: {
        organizationId: organizationId,
        authorPersonId: actorPersonId,
        body: content,
        visibility: NoteVisibility.STAFF_ONLY,
      },
      select: { id: true },
    });

    const createdEntry = await createOperationalEntry({
      organizationId: organizationId,
      type: EntryType.NOTE,
      title,
      content,
      tags,
      createdByPersonId: actorPersonId,
      assignedToPersonId,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: EntryPriority[priority],
      sourceNoteId: createdNote.id,
    });

    await writeEntryActivity({
      organizationId: organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: quickAddAction,
      metadata: { inferredType: parsed.inferredType, captureType, sourceNoteId: createdNote.id, assignedToPersonId },
    });
    if (assignedToPersonId) {
      await writeEntryActivity({
        organizationId: organizationId,
        entryId: createdEntry.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED,
        metadata: { personId: assignedToPersonId, role: "OWNER", source: "quick_add" },
      });
    }

    if (contextTarget) {
      await linkEntryToObject({
        organizationId: organizationId,
        entryId: createdEntry.id,
        targetType: contextTarget.targetType,
        targetId: contextTarget.targetId,
        createdByPersonId: actorPersonId,
      });

      await linkOperationalRecords({
        organizationId: organizationId,
        from: { nodeType: "ENTRY", nodeId: createdEntry.id },
        to: { nodeType: mapEntryObjectLinkTargetToGraphNodeType(contextTarget.targetType), nodeId: contextTarget.targetId },
        relationshipType: defaultContextRelationshipType(contextTarget.targetType),
        createdByPersonId: actorPersonId,
      });
    }

    if (shouldCreateInboxRoutingItem) {
      await db.inboxRoutingItem.create({
        data: {
          organizationId: organizationId,
          category: "ENTRY_CAPTURE",
          subjectRefType: "ENTRY",
          subjectRefId: createdEntry.id,
          priority: inboxPriority,
          status: InboxItemStatus.OPEN,
          ownerPersonId: assignedToPersonId,
          createdByPersonId: actorPersonId,
        },
      });
    }

      return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
    }

    const createdEntry = await createOperationalEntry({
      organizationId: organizationId,
      type: entryType,
      title,
      content,
      tags,
      createdByPersonId: actorPersonId,
      assignedToPersonId,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: EntryPriority[priority],
      dueDate,
      dueTime,
      timezone: "UTC",
    });

    await writeEntryActivity({
      organizationId: organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: quickAddAction,
      metadata: { inferredType: parsed.inferredType, captureType, entryType, assignedToPersonId },
    });
    if (assignedToPersonId) {
      await writeEntryActivity({
        organizationId: organizationId,
        entryId: createdEntry.id,
        actorPersonId,
        action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED,
        metadata: { personId: assignedToPersonId, role: "OWNER", source: "quick_add" },
      });
    }

    if (contextTarget) {
      await linkEntryToObject({
        organizationId: organizationId,
        entryId: createdEntry.id,
        targetType: contextTarget.targetType,
        targetId: contextTarget.targetId,
        createdByPersonId: actorPersonId,
      });

      await linkOperationalRecords({
        organizationId: organizationId,
        from: { nodeType: "ENTRY", nodeId: createdEntry.id },
        to: { nodeType: mapEntryObjectLinkTargetToGraphNodeType(contextTarget.targetType), nodeId: contextTarget.targetId },
        relationshipType: defaultContextRelationshipType(contextTarget.targetType),
        createdByPersonId: actorPersonId,
      });
    }

    if (shouldCreateInboxRoutingItem) {
      await db.inboxRoutingItem.create({
        data: {
          organizationId: organizationId,
          category: "ENTRY_CAPTURE",
          subjectRefType: "ENTRY",
          subjectRefId: createdEntry.id,
          priority: inboxPriority,
          status: InboxItemStatus.OPEN,
          ownerPersonId: assignedToPersonId,
          createdByPersonId: actorPersonId,
        },
      });
    }

    return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
  } catch {
    return NextResponse.redirect(
      buildQuickCaptureRedirectUrl({
        requestUrl: request.url,
        returnTo,
        values: redirectValues,
        error: "Quick capture failed before save completed. Your input is preserved.",
        openQuickCapture: true,
      }),
      303,
    );
  }
}
