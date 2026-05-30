import {
  EntryObjectLinkTargetType,
  EntryPriority,
  EntryStatus,
  EntryType,
  EntryVisibility,
  InboxItemStatus,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { mapEntryPriorityToInboxPriority, shouldRouteEntryToInbox } from "@/lib/entries/inbox";
import { resolveOrCreateDefaultList } from "@/lib/entries/lists";
import { parseQuickAddEntryInput } from "@/lib/entries/parser";
import {
  ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE,
  getEntryListSchemaIssue,
  logEntryListSchemaIssue,
} from "@/lib/entries/schema-guard";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { linkOperationalRecords, mapEntryObjectLinkTargetToGraphNodeType } from "@/lib/operational-graph";
import { ENTRY_ACTIVITY_ACTIONS, createOperationalEntry, linkEntryToObject, writeEntryActivity } from "@/lib/operational-entry";
import type { CreateOperationalEntryInput } from "@/lib/operational-entry/types";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";
import {
  isQuickCaptureContextTargetType,
  normalizeQuickCapturePriority,
  resolveQuickCaptureDueDate,
} from "@/lib/quick-capture";
import { resolveActorPersonId } from "@/lib/user-account";

type ContextTarget = { targetType: EntryObjectLinkTargetType; targetId: string };
const QUICK_CAPTURE_MODEL_TASK_ONLY = "TASK_ONLY";

function buildQuickCaptureRedirectUrl(input: {
  requestUrl: string;
  returnTo: string;
  values: {
    title: string;
    details: string;
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
  const rawPriority = String(formData.get("priority") ?? "").trim().toUpperCase();
  const rawDueShortcut = String(formData.get("dueShortcut") ?? "").trim().toUpperCase();
  const rawAssigneePersonId = String(formData.get("assigneePersonId") ?? "").trim();
  const rawContextTargetType = String(formData.get("contextTargetType") ?? "").trim().toUpperCase();
  const rawContextTargetId = String(formData.get("contextTargetId") ?? "").trim();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/dashboard");
  const redirectValues = {
    title: rawTitle,
    details: rawDetails,
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
  const entryType = EntryType.TASK;
  const dueDateFromShortcut = resolveQuickCaptureDueDate(rawDueShortcut);
  const dueDate = dueDateFromShortcut ?? parsed.dueDate;
  const dueTime = dueDateFromShortcut ? null : parsed.dueTime;
  const priority = normalizeQuickCapturePriority(rawPriority, parsed.priority);
  const content = rawDetails || parsed.content;
  const title = rawTitle || parsed.title;
  const tags = Array.from(new Set(parsed.tags));
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
      action: "task.create",
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
    contextTargetId: contextTarget?.targetId ?? null,
  });
  const quickAddAction = ENTRY_ACTIVITY_ACTIONS.ENTRY_QUICK_ADD_TASK;

  // Arc 24D.4: Resolve default list — Team Inbox when context is a team, Personal Inbox otherwise.
  let defaultListId: string | null = null;
  let listAssignmentWarning: string | null = null;
  try {
    if (scopedTeamId) {
      const list = await resolveOrCreateDefaultList({ scope: "TEAM", organizationId, teamId: scopedTeamId });
      defaultListId = list.id;
    } else if (actorPersonId) {
      const list = await resolveOrCreateDefaultList({ scope: "PERSONAL", organizationId, ownerPersonId: actorPersonId });
      defaultListId = list.id;
    }
  } catch (listErr) {
    if (getEntryListSchemaIssue(listErr)) {
      logEntryListSchemaIssue("entries.quick-add.resolve-default-list", listErr, { organizationId, actorPersonId, scopedTeamId });
      listAssignmentWarning = ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE;
    } else {
      console.warn("[entries.quick-add] Failed to resolve default list; entry will be unassigned", listErr);
    }
  }

  try {
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

    const createEntryInput: CreateOperationalEntryInput = {
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
    };

    let createdEntry;

    try {
      createdEntry = await createOperationalEntry({
        ...createEntryInput,
        ...(defaultListId ? { listId: defaultListId } : {}),
      });
    } catch (entryErr) {
      const schemaIssue = getEntryListSchemaIssue(entryErr);

      if (defaultListId && schemaIssue?.missing.includes("Entry.listId")) {
        logEntryListSchemaIssue("entries.quick-add.create-entry", entryErr, {
          organizationId,
          actorPersonId,
          defaultListId,
        });
        listAssignmentWarning = ENTRY_LIST_ASSIGNMENT_UNAVAILABLE_MESSAGE;
        createdEntry = await createOperationalEntry(createEntryInput);
      } else {
        throw entryErr;
      }
    }

    await writeEntryActivity({
      organizationId: organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: quickAddAction,
      metadata: { sourceTaskId: createdTask.id, assignedToPersonId, captureModel: QUICK_CAPTURE_MODEL_TASK_ONLY },
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

    const destination = new URL(`/entries/${createdEntry.id}`, request.url);
    if (listAssignmentWarning) {
      destination.searchParams.set("warning", listAssignmentWarning);
    }
    return NextResponse.redirect(destination, 303);
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
