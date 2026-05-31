/**
 * Arc 19B — Unified Feed & Today View
 *
 * Pure rendering helpers for the operational feed.
 * These are pure functions — no DB or React dependencies — and are fully testable.
 */

import type { EntryPriority, EntryStatus, EntryType } from "@prisma/client";

import type { FeedActivityEntryType } from "./types";

// ── Entry type labels ───────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<string, string> = {
  TASK: "Task",
  NOTE: "Note",
  EVENT: "Event",
  DECISION: "Decision",
  JOURNAL: "Journal",
  HABIT: "Habit",
  OBSERVATION: "Observation",
  FOLLOW_UP: "Follow-up",
  ACTIVITY: "Activity",
  READINESS_ITEM: "Readiness",
};

export function labelForEntryType(type: EntryType): string {
  return ENTRY_TYPE_LABELS[type] ?? type;
}

// ── Entry status labels ─────────────────────────────────────────────────────

const ENTRY_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
};

export function labelForEntryStatus(status: EntryStatus): string {
  return ENTRY_STATUS_LABELS[status] ?? status;
}

// ── Entry priority labels ───────────────────────────────────────────────────

const ENTRY_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function labelForEntryPriority(priority: EntryPriority): string {
  return ENTRY_PRIORITY_LABELS[priority] ?? priority;
}

// ── Activity action labels ──────────────────────────────────────────────────

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  "entry.created": "Created",
  "entry.updated": "Updated",
  "entry.status_changed": "Status changed",
  "entry.linked": "Linked to entry",
  "entry.unlinked": "Unlinked from entry",
  "entry.assignment_added": "Assigned",
  "entry.assignment_revoked": "Assignment removed",
  "entry.follow_up_created": "Follow-up created",
  "entry.follow_up_assigned": "Follow-up assigned",
  "entry.follow_up_completed": "Follow-up completed",
  "entry.object_link_added": "Linked to object",
  "entry.object_link_removed": "Unlinked from object",
  "entry.graph_link_added": "Graph link added",
  "entry.graph_link_removed": "Graph link removed",
  "entry.completed": "Completed",
  "entry.archived": "Archived",
  "entry.task_completed": "Completed",
  "entry.deleted": "Deleted",
  "entry.soft_deleted": "Deleted",
  "entry.restored": "Restored",
  "entry.quick_add.task": "Quick-added task",
  "entry.quick_add.note": "Quick-added note",
  "entry.quick_add.generic": "Quick-added entry",
  "entry.note_to_task_converted": "Converted note to task",
  "entry.note_converted_to_task": "Converted note to task",
  "workflow.run_started": "Workflow run started",
  "workflow.step_completed": "Step completed",
  "workflow.run_completed": "Workflow completed",
  "workflow.run_cancelled": "Workflow cancelled",
  "workflow.chain_created": "Follow-up chain created",
  "journal.draft_created": "Journal draft created",
  "journal.draft_updated": "Journal draft updated",
  "journal.submitted": "Journal finalized",
  "journal.reopened": "Journal reopened",
  "journal.archived": "Journal archived",
  "journal.restored": "Journal restored",
  "journal.prompt_assigned": "Journal prompt assigned",
  "journal.prompt_response_submitted": "Journal prompt completed",
  "journal.prompt_assignment_cancelled": "Prompt assignment cancelled",
  // Arc 23D: Habit activity actions
  "habit.created": "Habit created",
  "habit.updated": "Habit updated",
  "habit.assigned": "Habit assigned",
  "habit.archived": "Habit archived",
  "habit.paused": "Habit paused",
  "habit.resumed": "Habit resumed",
  "habit.checked_in": "Habit check-in recorded",
  // Arc 24D.8: Additional habit lifecycle actions
  "habit.completed": "Habit completed",
  "habit.restored": "Habit restored",
};

export function labelForActivityAction(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action;
}

const ACTIVITY_VERB_OVERRIDES: Record<string, string> = {
  "entry.created": "Created",
  "entry.updated": "Updated",
  "entry.completed": "Completed",
  "entry.task_completed": "Completed",
  "entry.quick_add.task": "Captured",
  "journal.submitted": "Submitted",
  "habit.checked_in": "Completed",
  "habit.completed": "Completed",
};

function nounForActivityType(entryType: FeedActivityEntryType): string {
  if (entryType === "HABIT_ACTIVITY") return "habit occurrence";
  if (entryType === "JOURNAL") return "journal";
  if (entryType === "DECISION") return "decision";
  if (entryType === "EVENT") return "event";
  if (entryType === "NOTE") return "note";
  if (entryType === "TASK") return "task";
  return "work item";
}

export function describeActivityAction(action: string, entryType: FeedActivityEntryType): string {
  const verbOverride = ACTIVITY_VERB_OVERRIDES[action];
  if (!verbOverride) return labelForActivityAction(action);
  return `${verbOverride} ${nounForActivityType(entryType)}`.trim();
}

export function hrefForActivityItem(entryId: string, entryType: FeedActivityEntryType): string {
  if (entryType === "HABIT_ACTIVITY") return `/habits/${entryId}`;
  if (entryType === "JOURNAL") return `/journals/${entryId}`;
  return `/entries/${entryId}`;
}

// ── Date formatting helpers ─────────────────────────────────────────────────

/**
 * Formats a dueDate and optional dueTime for display.
 * Returns null if no dueDate is set.
 */
export function formatDueDate(dueDate: Date | null, dueTime: string | null): string | null {
  if (!dueDate) return null;
  const datePart = dueDate.toISOString().slice(0, 10);
  return dueTime ? `${datePart} ${dueTime}` : datePart;
}

/**
 * Returns true if the entry's dueDate is strictly before today's UTC midnight.
 */
export function isOverdueFeedEntry(dueDate: Date | null, now: Date): boolean {
  if (!dueDate) return false;
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return dueDate.getTime() < todayStart.getTime();
}
