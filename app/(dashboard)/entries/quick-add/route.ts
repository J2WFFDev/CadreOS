import { EntryPriority, EntryStatus, EntryType, EntryVisibility, NoteVisibility, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { parseQuickAddEntryInput } from "@/lib/entries/parser";
import { writeEntryActivity } from "@/lib/entries/service";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";

function resolveEntryType(inputType: string, inferredType: "TASK" | "NOTE"): EntryType {
  if (inputType === "TASK") return EntryType.TASK;
  if (inputType === "NOTE") return EntryType.NOTE;
  if (inputType === "EVENT") return EntryType.EVENT;
  if (inputType === "DECISION") return EntryType.DECISION;
  return inferredType === "TASK" ? EntryType.TASK : EntryType.NOTE;
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
  const rawType = String(formData.get("entryType") ?? "AUTO").trim().toUpperCase();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/dashboard");

  if (!scope.databaseReady || !scope.organizationId || !rawInput) {
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

  const parsed = parseQuickAddEntryInput(rawInput);
  const entryType = resolveEntryType(rawType, parsed.inferredType);
  const dueAt = mergeDueAt(parsed.dueDate, parsed.dueTime);

  if (entryType === EntryType.TASK) {
    const createdTask = await db.followUpTask.create({
      data: {
        organizationId: scope.organizationId,
        title: parsed.title,
        description: parsed.content,
        status: TaskStatus.OPEN,
        assigneePersonId: actorPersonId,
        createdByPersonId: actorPersonId,
        dueAt,
      },
      select: { id: true },
    });

    const createdEntry = await db.entry.create({
      data: {
        organizationId: scope.organizationId,
        type: EntryType.TASK,
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags,
        createdByPersonId: actorPersonId,
        assignedToPersonId: actorPersonId,
        visibility: EntryVisibility.STAFF_ONLY,
        status: EntryStatus.OPEN,
        priority: EntryPriority[parsed.priority],
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        timezone: "UTC",
        taskRecurrenceRule: parsed.recurrenceRule,
        sourceTaskId: createdTask.id,
      },
      select: { id: true },
    });

    await writeEntryActivity({
      organizationId: scope.organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: "entry.quick_add.task",
      metadata: { inferredType: parsed.inferredType, sourceTaskId: createdTask.id },
    });

    return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
  }

  if (entryType === EntryType.NOTE) {
    const createdNote = await db.observationNote.create({
      data: {
        organizationId: scope.organizationId,
        authorPersonId: actorPersonId,
        body: parsed.content,
        visibility: NoteVisibility.STAFF_ONLY,
      },
      select: { id: true },
    });

    const createdEntry = await db.entry.create({
      data: {
        organizationId: scope.organizationId,
        type: EntryType.NOTE,
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags,
        createdByPersonId: actorPersonId,
        visibility: EntryVisibility.STAFF_ONLY,
        status: EntryStatus.OPEN,
        priority: EntryPriority[parsed.priority],
        sourceNoteId: createdNote.id,
      },
      select: { id: true },
    });

    await writeEntryActivity({
      organizationId: scope.organizationId,
      entryId: createdEntry.id,
      actorPersonId,
      action: "entry.quick_add.note",
      metadata: { inferredType: parsed.inferredType, sourceNoteId: createdNote.id },
    });

    return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
  }

  const createdEntry = await db.entry.create({
    data: {
      organizationId: scope.organizationId,
      type: entryType,
      title: parsed.title,
      content: parsed.content,
      tags: parsed.tags,
      createdByPersonId: actorPersonId,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: EntryPriority[parsed.priority],
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      timezone: "UTC",
    },
    select: { id: true },
  });

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId: createdEntry.id,
    actorPersonId,
    action: "entry.quick_add.generic",
    metadata: { inferredType: parsed.inferredType, entryType },
  });

  return NextResponse.redirect(new URL(`/entries/${createdEntry.id}`, request.url), 303);
}
