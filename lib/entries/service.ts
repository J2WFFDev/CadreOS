import { EntryPriority, EntryStatus, EntryType, EntryVisibility, TaskStatus } from "@prisma/client";

import { db } from "@/lib/db";
export { writeEntryActivity } from "@/lib/operational-entry/service";

export function mapTaskStatusToEntryStatus(status: TaskStatus): EntryStatus {
  if (status === TaskStatus.DONE) return EntryStatus.DONE;
  if (status === TaskStatus.CANCELLED) return EntryStatus.CANCELLED;
  if (status === TaskStatus.IN_PROGRESS) return EntryStatus.IN_PROGRESS;
  return EntryStatus.OPEN;
}

export function mapEntryStatusToTaskStatus(status: EntryStatus): TaskStatus {
  if (status === EntryStatus.DONE) return TaskStatus.DONE;
  if (status === EntryStatus.CANCELLED || status === EntryStatus.ARCHIVED) return TaskStatus.CANCELLED;
  if (status === EntryStatus.IN_PROGRESS) return TaskStatus.IN_PROGRESS;
  return TaskStatus.OPEN;
}

function splitDueAt(dueAt: Date | null) {
  if (!dueAt) {
    return { dueDate: null, dueTime: null };
  }

  return {
    dueDate: new Date(Date.UTC(dueAt.getUTCFullYear(), dueAt.getUTCMonth(), dueAt.getUTCDate())),
    dueTime: `${String(dueAt.getUTCHours()).padStart(2, "0")}:${String(dueAt.getUTCMinutes()).padStart(2, "0")}`,
  };
}

export function buildTaskEntryProjection(input: { dueAt: Date | null; status: TaskStatus }) {
  const due = splitDueAt(input.dueAt);
  return {
    dueDate: due.dueDate,
    dueTime: due.dueTime,
    status: mapTaskStatusToEntryStatus(input.status),
    taskCompleted: input.status === TaskStatus.DONE,
  };
}

export function deriveTaskCompletionUpdate(now: Date = new Date()) {
  return {
    status: EntryStatus.DONE,
    taskCompleted: true,
    completedAt: now,
  };
}

export function deriveNoteToTaskTitle(input: { selectedText: string; title: string; content: string | null }) {
  const trimmedSelected = input.selectedText.trim();
  if (trimmedSelected.length > 0) return trimmedSelected.slice(0, 160);
  if (input.title.trim().length > 0) return input.title.trim().slice(0, 160);
  if (input.content?.trim()) return input.content.trim().slice(0, 160);
  return "Converted note task";
}

export function deriveEntryFollowUpDraft(input: {
  entryTitle: string;
  entryContent: string | null;
  providedTitle?: string | null;
  providedDescription?: string | null;
}) {
  const trimmedProvidedTitle = input.providedTitle?.trim() ?? "";
  const trimmedProvidedDescription = input.providedDescription?.trim() ?? "";
  const trimmedEntryTitle = input.entryTitle.trim();
  const trimmedEntryContent = input.entryContent?.trim() ?? "";

  return {
    title:
      trimmedProvidedTitle.length > 0
        ? trimmedProvidedTitle.slice(0, 160)
        : trimmedEntryTitle.length > 0
          ? `Follow up: ${trimmedEntryTitle}`.slice(0, 160)
          : "Entry follow-up task",
    description:
      trimmedProvidedDescription.length > 0
        ? trimmedProvidedDescription
        : trimmedEntryContent.length > 0
          ? trimmedEntryContent
          : trimmedEntryTitle.length > 0
            ? `Follow-up action for entry: ${trimmedEntryTitle}`
            : null,
  };
}

export async function upsertEntryFromTask(input: {
  organizationId: string;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority?: EntryPriority;
    tags?: string[];
    assigneePersonId: string;
    createdByPersonId: string;
    dueAt: Date | null;
  };
}) {
  const projection = buildTaskEntryProjection({ dueAt: input.task.dueAt, status: input.task.status });

  return db.entry.upsert({
    where: { sourceTaskId: input.task.id },
    create: {
      organizationId: input.organizationId,
      type: EntryType.TASK,
      title: input.task.title,
      content: input.task.description,
      tags: input.task.tags ?? [],
      createdByPersonId: input.task.createdByPersonId,
      assignedToPersonId: input.task.assigneePersonId,
      visibility: EntryVisibility.STAFF_ONLY,
      status: projection.status,
      priority: input.task.priority ?? EntryPriority.MEDIUM,
      dueDate: projection.dueDate,
      dueTime: projection.dueTime,
      timezone: "UTC",
      taskCompleted: projection.taskCompleted,
      completedAt: input.task.status === TaskStatus.DONE ? new Date() : null,
      sourceTaskId: input.task.id,
    },
    update: {
      title: input.task.title,
      content: input.task.description,
      ...(input.task.tags ? { tags: input.task.tags } : {}),
      assignedToPersonId: input.task.assigneePersonId,
      status: projection.status,
      ...(input.task.priority ? { priority: input.task.priority } : {}),
      dueDate: projection.dueDate,
      dueTime: projection.dueTime,
      taskCompleted: projection.taskCompleted,
      completedAt: input.task.status === TaskStatus.DONE ? new Date() : null,
      version: { increment: 1 },
    },
    select: { id: true, type: true, tags: true },
  });
}

export async function upsertEntryFromNote(input: {
  organizationId: string;
  note: {
    id: string;
    body: string;
    authorPersonId: string;
    teamId: string | null;
  };
}) {
  return db.entry.upsert({
    where: { sourceNoteId: input.note.id },
    create: {
      organizationId: input.organizationId,
      teamId: input.note.teamId,
      type: EntryType.NOTE,
      title: input.note.body.length > 120 ? `${input.note.body.slice(0, 117)}...` : input.note.body,
      content: input.note.body,
      createdByPersonId: input.note.authorPersonId,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      sourceNoteId: input.note.id,
    },
    update: {
      teamId: input.note.teamId,
      title: input.note.body.length > 120 ? `${input.note.body.slice(0, 117)}...` : input.note.body,
      content: input.note.body,
      version: { increment: 1 },
    },
    select: { id: true },
  });
}
