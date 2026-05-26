import {
  EntryObjectLinkTargetType,
  EntryPriority,
  EntryStatus,
  EntryType,
  EntryVisibility,
  NoteVisibility,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { parseQuickAddEntryInput } from "@/lib/entries/parser";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { createOperationalEntry, linkEntryToObject, writeEntryActivity } from "@/lib/operational-entry";
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

  if (!scope.databaseReady || !scope.organizationId || !effectiveInput) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const actorPersonId = await resolveActorPersonId({
    organizationId: scope.organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  if (!actorPersonId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const parsed = parseQuickAddEntryInput(effectiveInput);
  const resolvedType = resolveQuickCaptureEntryType({
    captureType,
    legacyEntryType: rawType,
    inferredType: parsed.inferredType,
  });
  const entryType = EntryType[resolvedType];
  if (!entryType) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
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
    organizationId: scope.organizationId,
    rawTargetType: rawContextTargetType,
    rawTargetId: rawContextTargetId,
  });

  const scopedTeamId = contextTarget?.targetType === EntryObjectLinkTargetType.TEAM ? contextTarget.targetId : null;
  const scopedEventId = contextTarget?.targetType === EntryObjectLinkTargetType.EVENT ? contextTarget.targetId : null;

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: scope.organizationId,
      action: entryType === EntryType.TASK ? "task.create" : entryType === EntryType.NOTE ? "note.create" : "entry.create",
      teamId: scopedTeamId,
      eventId: scopedEventId,
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const resolvedAssigneePersonId = rawAssigneePersonId
    ? (
        await db.person.findFirst({
          where: { id: rawAssigneePersonId, organizationId: scope.organizationId },
          select: { id: true },
        })
      )?.id ?? null
    : null;
  const assignedToPersonId = resolvedAssigneePersonId ?? actorPersonId;
  const quickAddAction =
    entryType === EntryType.TASK ? "entry.quick_add.task" : entryType === EntryType.NOTE ? "entry.quick_add.note" : "entry.quick_add.generic";

  if (entryType === EntryType.TASK) {
    const createdTask = await db.followUpTask.create({
      data: {
        organizationId: scope.organizationId,
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
      organizationId: scope.organizationId,
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
      organizationId: scope.organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: quickAddAction,
      metadata: { inferredType: parsed.inferredType, captureType, sourceTaskId: createdTask.id, assignedToPersonId },
    });

    if (contextTarget) {
      await linkEntryToObject({
        organizationId: scope.organizationId,
        entryId: createdEntry.id,
        targetType: contextTarget.targetType,
        targetId: contextTarget.targetId,
        createdByPersonId: actorPersonId,
      });
    }

    return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
  }

  if (entryType === EntryType.NOTE) {
    const createdNote = await db.observationNote.create({
      data: {
        organizationId: scope.organizationId,
        authorPersonId: actorPersonId,
        body: content,
        visibility: NoteVisibility.STAFF_ONLY,
      },
      select: { id: true },
    });

    const createdEntry = await createOperationalEntry({
      organizationId: scope.organizationId,
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
      organizationId: scope.organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: quickAddAction,
      metadata: { inferredType: parsed.inferredType, captureType, sourceNoteId: createdNote.id, assignedToPersonId },
    });

    if (contextTarget) {
      await linkEntryToObject({
        organizationId: scope.organizationId,
        entryId: createdEntry.id,
        targetType: contextTarget.targetType,
        targetId: contextTarget.targetId,
        createdByPersonId: actorPersonId,
      });
    }

    return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
  }

  const createdEntry = await createOperationalEntry({
    organizationId: scope.organizationId,
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
    organizationId: scope.organizationId,
    entryId: createdEntry.id,
    actorPersonId,
    action: quickAddAction,
    metadata: { inferredType: parsed.inferredType, captureType, entryType, assignedToPersonId },
  });

  if (contextTarget) {
    await linkEntryToObject({
      organizationId: scope.organizationId,
      entryId: createdEntry.id,
      targetType: contextTarget.targetType,
      targetId: contextTarget.targetId,
      createdByPersonId: actorPersonId,
    });
  }

  return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
}
