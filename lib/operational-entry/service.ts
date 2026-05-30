/**
 * Arc 19A — Unified Operational Entry Architecture
 *
 * Core operational entry service.
 * Provides create, update, status change, object linking, and assignment
 * operations for the unified OperationalEntry domain model.
 *
 * The existing lib/entries/service.ts helpers remain available for backward
 * compatibility with the task/note upsert compatibility layer.
 */

import { EntryAssignmentRole, EntryStatus, EntryVisibility, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { emitEntryActivityAwareness } from "@/lib/notifications";
import { ENTRY_ACTIVITY_ACTIONS } from "./types";
import type {
  AssignEntryInput,
  ChangeEntryStatusInput,
  CreateOperationalEntryInput,
  LinkEntryToObjectInput,
  RevokeEntryAssignmentInput,
  UpdateOperationalEntryInput,
} from "./types";

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Creates a new OperationalEntry and writes an entry.created activity record.
 * Does not create legacy FollowUpTask or ObservationNote backing records —
 * use the quick-add route for legacy-compatible task/note creation.
 */
export async function createOperationalEntry(input: CreateOperationalEntryInput) {
  const entry = await db.entry.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      content: input.content ?? null,
      tags: input.tags ?? [],
      createdByPersonId: input.createdByPersonId,
      assignedToPersonId: input.assignedToPersonId ?? null,
      visibility: input.visibility ?? EntryVisibility.STAFF_ONLY,
      status: input.status ?? EntryStatus.OPEN,
      priority: input.priority ?? "MEDIUM",
      teamId: input.teamId ?? null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      occurredAt: input.occurredAt ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      timezone: input.timezone ?? null,
      parentEntryId: input.parentEntryId ?? null,
      taskRecurrenceRule: input.taskRecurrenceRule ?? null,
      sourceTaskId: input.sourceTaskId ?? null,
      sourceNoteId: input.sourceNoteId ?? null,
      ...(input.listId !== undefined && input.listId !== null ? { listId: input.listId } : {}),
    },
    select: { id: true, organizationId: true, type: true, status: true },
  });

  await writeEntryActivity({
    organizationId: entry.organizationId,
    entryId: entry.id,
    actorPersonId: input.createdByPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_CREATED,
    metadata: { type: entry.type },
  });

  return entry;
}

// ── Update ──────────────────────────────────────────────────────────────────

/**
 * Updates an OperationalEntry's editable fields and writes an entry.updated
 * activity record. If status changes, also records an EntryStatusHistory row.
 */
export async function updateOperationalEntry(input: UpdateOperationalEntryInput) {
  const existing = await db.entry.findFirst({
    where: { id: input.entryId, organizationId: input.organizationId, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!existing) return null;

  const prevStatus = existing.status;
  const nextStatus = input.status;

  await db.entry.update({
    where: { id: existing.id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(nextStatus ? { status: nextStatus, taskCompleted: nextStatus === EntryStatus.DONE, completedAt: nextStatus === EntryStatus.DONE ? new Date() : null } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.dueTime !== undefined ? { dueTime: input.dueTime } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.updatedByPersonId !== undefined ? { updatedByPersonId: input.updatedByPersonId } : {}),
      version: { increment: 1 },
    },
  });

  if (nextStatus && nextStatus !== prevStatus) {
    await db.entryStatusHistory.create({
      data: {
        organizationId: input.organizationId,
        entryId: existing.id,
        fromStatus: prevStatus,
        toStatus: nextStatus,
        changedByPersonId: input.updatedByPersonId ?? null,
        note: input.statusChangeNote ?? null,
      },
    });
  }

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: existing.id,
    actorPersonId: input.updatedByPersonId ?? null,
    action: nextStatus && nextStatus !== prevStatus ? ENTRY_ACTIVITY_ACTIONS.ENTRY_STATUS_CHANGED : ENTRY_ACTIVITY_ACTIONS.ENTRY_UPDATED,
    metadata: {
      changedStatus: nextStatus ?? null,
      changedPriority: input.priority ?? null,
    },
  });

  return { id: existing.id };
}

// ── Status change ───────────────────────────────────────────────────────────

/**
 * Changes an entry's status and records both an EntryStatusHistory row and an
 * entry.status_changed activity record. Idiomatic for discrete state machine
 * transitions where only status changes (not other fields).
 */
export async function changeEntryStatus(input: ChangeEntryStatusInput) {
  const existing = await db.entry.findFirst({
    where: { id: input.entryId, organizationId: input.organizationId, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!existing) return null;

  const prevStatus = existing.status;

  await db.entry.update({
    where: { id: existing.id },
    data: {
      status: input.toStatus,
      taskCompleted: input.toStatus === EntryStatus.DONE,
      completedAt: input.toStatus === EntryStatus.DONE ? new Date() : null,
      version: { increment: 1 },
    },
  });

  await db.entryStatusHistory.create({
    data: {
      organizationId: input.organizationId,
      entryId: existing.id,
      fromStatus: prevStatus,
      toStatus: input.toStatus,
      changedByPersonId: input.changedByPersonId ?? null,
      note: input.note ?? null,
    },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: existing.id,
    actorPersonId: input.changedByPersonId ?? null,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_STATUS_CHANGED,
    metadata: { fromStatus: prevStatus, toStatus: input.toStatus },
  });

  return { id: existing.id, fromStatus: prevStatus, toStatus: input.toStatus };
}

// ── Object linking ──────────────────────────────────────────────────────────

/**
 * Creates an EntryObjectLink connecting an entry to a CadreOS domain object.
 * Idempotent: if the link already exists, returns without error.
 */
export async function linkEntryToObject(input: LinkEntryToObjectInput) {
  const existing = await db.entryObjectLink.findFirst({
    where: {
      organizationId: input.organizationId,
      entryId: input.entryId,
      targetType: input.targetType,
      targetId: input.targetId,
    },
    select: { id: true },
  });

  if (existing) return existing;

  const link = await db.entryObjectLink.create({
    data: {
      organizationId: input.organizationId,
      entryId: input.entryId,
      targetType: input.targetType,
      targetId: input.targetId,
      createdByPersonId: input.createdByPersonId,
    },
    select: { id: true },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: input.entryId,
    actorPersonId: input.createdByPersonId,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_OBJECT_LINKED,
    metadata: { targetType: input.targetType, targetId: input.targetId },
  });

  return link;
}

/**
 * Removes an EntryObjectLink between an entry and a CadreOS domain object.
 */
export async function unlinkEntryFromObject(input: Omit<LinkEntryToObjectInput, "createdByPersonId"> & { actorPersonId?: string | null }) {
  const existing = await db.entryObjectLink.findFirst({
    where: {
      organizationId: input.organizationId,
      entryId: input.entryId,
      targetType: input.targetType,
      targetId: input.targetId,
    },
    select: { id: true },
  });

  if (!existing) return null;

  await db.entryObjectLink.delete({ where: { id: existing.id } });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: input.entryId,
    actorPersonId: input.actorPersonId ?? null,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_OBJECT_UNLINKED,
    metadata: { targetType: input.targetType, targetId: input.targetId },
  });

  return { id: existing.id };
}

// ── Assignment ──────────────────────────────────────────────────────────────

/**
 * Creates an EntryAssignment for a person with the specified role.
 * Idempotent: if the assignment already exists and is not revoked, returns it.
 */
export async function assignEntry(input: AssignEntryInput) {
  const role = input.role ?? EntryAssignmentRole.OWNER;

  const existing = await db.entryAssignment.findFirst({
    where: {
      entryId: input.entryId,
      personId: input.personId,
      role,
      revokedAt: null,
    },
    select: { id: true },
  });

  if (existing) return existing;

  const assignment = await db.entryAssignment.create({
    data: {
      organizationId: input.organizationId,
      entryId: input.entryId,
      personId: input.personId,
      role,
      assignedByPersonId: input.assignedByPersonId ?? null,
    },
    select: { id: true },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: input.entryId,
    actorPersonId: input.assignedByPersonId ?? null,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNED,
    metadata: { personId: input.personId, role },
  });

  return assignment;
}

/**
 * Revokes an EntryAssignment by setting revokedAt.
 */
export async function revokeEntryAssignment(input: RevokeEntryAssignmentInput) {
  const existing = await db.entryAssignment.findFirst({
    where: {
      entryId: input.entryId,
      organizationId: input.organizationId,
      personId: input.personId,
      role: input.role,
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!existing) return null;

  await db.entryAssignment.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: input.entryId,
    actorPersonId: null,
    action: ENTRY_ACTIVITY_ACTIONS.ENTRY_ASSIGNMENT_REVOKED,
    metadata: { personId: input.personId, role: input.role },
  });

  return { id: existing.id };
}

// ── Activity ────────────────────────────────────────────────────────────────

/**
 * Writes an EntryActivity record. Used internally and by legacy entry routes.
 */
export async function writeEntryActivity(input: {
  organizationId: string;
  entryId: string;
  actorPersonId: string | null;
  action: string;
  metadata?: Prisma.JsonObject | null;
}) {
  await db.entryActivity.create({
    data: {
      organizationId: input.organizationId,
      entryId: input.entryId,
      actorPersonId: input.actorPersonId,
      action: input.action,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  try {
    await emitEntryActivityAwareness({
      organizationId: input.organizationId,
      entryId: input.entryId,
      actorPersonId: input.actorPersonId,
      action: input.action,
      metadata: (input.metadata as Record<string, unknown> | null | undefined) ?? null,
    });
  } catch {
    // Notification routing is non-authoritative and must not block operational entry writes.
  }
}
