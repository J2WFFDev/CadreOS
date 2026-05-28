/**
 * Arc 19A — Unified Operational Entry Architecture
 *
 * Canonical TypeScript type definitions for the OperationalEntry domain model.
 * These types represent the shared operational behaviors across all entry subtypes.
 */

import type {
  EntryAssignmentRole,
  EntryObjectLinkTargetType,
  EntryPriority,
  EntryStatus,
  EntryType,
  EntryVisibility,
} from "@prisma/client";

// ── Re-export Prisma enums for convenience ──────────────────────────────────

export { EntryAssignmentRole, EntryObjectLinkTargetType, EntryPriority, EntryStatus, EntryType, EntryVisibility };

// ── Entry type set for Arc 19A ──────────────────────────────────────────────

/** All supported entry types, including the Arc 19A additions. */
export const OPERATIONAL_ENTRY_TYPES = [
  "TASK",
  "NOTE",
  "EVENT",
  "DECISION",
  "FOLLOW_UP",
  "OBSERVATION",
  "ACTIVITY",
  "JOURNAL",
  "READINESS_ITEM",
  "HABIT",
] as const;

export type OperationalEntryType = (typeof OPERATIONAL_ENTRY_TYPES)[number];

// ── Core input types ────────────────────────────────────────────────────────

/** Input for creating a new OperationalEntry. */
export type CreateOperationalEntryInput = {
  organizationId: string;
  type: EntryType;
  title: string;
  content?: string | null;
  tags?: string[];
  createdByPersonId: string;
  assignedToPersonId?: string | null;
  visibility?: EntryVisibility;
  status?: EntryStatus;
  priority?: EntryPriority;
  teamId?: string | null;
  dueDate?: Date | null;
  dueTime?: string | null;
  occurredAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  timezone?: string | null;
  parentEntryId?: string | null;
  taskRecurrenceRule?: string | null;
  sourceTaskId?: string | null;
  sourceNoteId?: string | null;
};

/** Input for updating an existing OperationalEntry. */
export type UpdateOperationalEntryInput = {
  organizationId: string;
  entryId: string;
  updatedByPersonId?: string | null;
  title?: string;
  content?: string | null;
  type?: EntryType;
  status?: EntryStatus;
  priority?: EntryPriority;
  dueDate?: Date | null;
  dueTime?: string | null;
  occurredAt?: Date | null;
  tags?: string[];
  statusChangeNote?: string | null;
};

/** Input for changing only the status of an entry. */
export type ChangeEntryStatusInput = {
  organizationId: string;
  entryId: string;
  toStatus: EntryStatus;
  changedByPersonId?: string | null;
  note?: string | null;
};

/** Input for linking an entry to a CadreOS domain object. */
export type LinkEntryToObjectInput = {
  organizationId: string;
  entryId: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
  createdByPersonId: string;
};

/** Input for assigning an entry to a person. */
export type AssignEntryInput = {
  organizationId: string;
  entryId: string;
  personId: string;
  role?: EntryAssignmentRole;
  assignedByPersonId?: string | null;
};

/** Input for revoking an entry assignment. */
export type RevokeEntryAssignmentInput = {
  organizationId: string;
  entryId: string;
  personId: string;
  role: EntryAssignmentRole;
};

// ── Activity action constants ───────────────────────────────────────────────

/** Standardized action strings for EntryActivity records. */
export const ENTRY_ACTIVITY_ACTIONS = {
  ENTRY_CREATED: "entry.created",
  ENTRY_UPDATED: "entry.updated",
  ENTRY_STATUS_CHANGED: "entry.status_changed",
  ENTRY_LINKED: "entry.linked",
  ENTRY_UNLINKED: "entry.unlinked",
  ENTRY_ASSIGNED: "entry.assignment_added",
  ENTRY_ASSIGNMENT_REVOKED: "entry.assignment_revoked",
  ENTRY_OBJECT_LINKED: "entry.object_link_added",
  ENTRY_OBJECT_UNLINKED: "entry.object_link_removed",
  ENTRY_GRAPH_LINKED: "entry.graph_link_added",
  ENTRY_GRAPH_UNLINKED: "entry.graph_link_removed",
  FOLLOW_UP_CREATED: "entry.follow_up_created",
  FOLLOW_UP_ASSIGNED: "entry.follow_up_assigned",
  FOLLOW_UP_COMPLETED: "entry.follow_up_completed",
  ENTRY_COMPLETED: "entry.completed",
  ENTRY_ARCHIVED: "entry.archived",
  ENTRY_DELETED: "entry.deleted",
  ENTRY_RESTORED: "entry.restored",
  ENTRY_QUICK_ADD_TASK: "entry.quick_add.task",
  ENTRY_QUICK_ADD_NOTE: "entry.quick_add.note",
  ENTRY_QUICK_ADD_GENERIC: "entry.quick_add.generic",
  ENTRY_NOTE_TO_TASK_CONVERTED: "entry.note_to_task_converted",
  JOURNAL_DRAFT_CREATED: "journal.draft_created",
  JOURNAL_DRAFT_UPDATED: "journal.draft_updated",
  JOURNAL_SUBMITTED: "journal.submitted",
  JOURNAL_ARCHIVED: "journal.archived",
  // Arc 23C: Prompt assignment activity actions
  JOURNAL_PROMPT_ASSIGNED: "journal.prompt_assigned",
  JOURNAL_PROMPT_RESPONSE_SUBMITTED: "journal.prompt_response_submitted",
  JOURNAL_PROMPT_ASSIGNMENT_CANCELLED: "journal.prompt_assignment_cancelled",
  // Backward-compatible aliases used by older route/service code.
  CREATED: "entry.created",
  UPDATED: "entry.updated",
  STATUS_CHANGED: "entry.status_changed",
  ASSIGNMENT_ADDED: "entry.assignment_added",
  ASSIGNMENT_REVOKED: "entry.assignment_revoked",
  OBJECT_LINK_ADDED: "entry.object_link_added",
  OBJECT_LINK_REMOVED: "entry.object_link_removed",
  GRAPH_LINK_ADDED: "entry.graph_link_added",
  GRAPH_LINK_REMOVED: "entry.graph_link_removed",
  COMPLETED: "entry.completed",
  ARCHIVED: "entry.archived",
  DELETED: "entry.deleted",
  RESTORED: "entry.restored",
  QUICK_ADD_TASK: "entry.quick_add.task",
  QUICK_ADD_NOTE: "entry.quick_add.note",
  QUICK_ADD_GENERIC: "entry.quick_add.generic",
  NOTE_TO_TASK_CONVERTED: "entry.note_to_task_converted",
} as const;

export type EntryActivityAction = (typeof ENTRY_ACTIVITY_ACTIONS)[keyof typeof ENTRY_ACTIVITY_ACTIONS];

// ── View types (read-side projections) ─────────────────────────────────────

/** Minimal projection for entry list/reference display. */
export type OperationalEntryRef = {
  id: string;
  type: EntryType;
  title: string;
  status: EntryStatus;
  priority: EntryPriority;
};

/** Projection for an entry object link, including resolved display metadata. */
export type EntryObjectLinkView = {
  id: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
  createdAt: Date;
};

/** Projection for an entry assignment record. */
export type EntryAssignmentView = {
  id: string;
  personId: string;
  role: EntryAssignmentRole;
  assignedAt: Date;
  revokedAt: Date | null;
};

/** Projection for a status history record. */
export type EntryStatusHistoryView = {
  id: string;
  fromStatus: EntryStatus | null;
  toStatus: EntryStatus;
  note: string | null;
  changedAt: Date;
  changedByPersonId: string | null;
};
