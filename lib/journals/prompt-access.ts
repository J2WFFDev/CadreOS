/**
 * Arc 23C — Prompt Library and Prompt Assignment
 *
 * Authorization helpers for the JournalPrompt and JournalAssignment models.
 * These are pure functions — no DB dependencies — and are fully testable.
 *
 * Role policy summary:
 * - ORGANIZATION_ADMIN / PROGRAM_DIRECTOR: full prompt management + assignment
 * - COACH / ASSISTANT_COACH: can assign prompts (within org scope); cannot create/edit/archive
 * - ATHLETE: can read active prompts and respond to their assignments
 * - PARENT_GUARDIAN: can see assignment status/completion for linked athletes only
 */

import { JournalAssignmentStatus, RoleType } from "@prisma/client";

import type { JournalAccessContext } from "./access";

const ADMIN_ROLE_TYPES = new Set<RoleType>([RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR]);
const STAFF_ROLE_TYPES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
]);

export type PromptAssignmentContext = {
  promptId: string;
  assignedToAthletePersonId: string | null;
  assignedToTeamId: string | null;
  assignedByPersonId: string;
  status: JournalAssignmentStatus;
};

// ── Prompt library management ────────────────────────────────────────────────

/** Admin/program directors can create, edit, and archive prompts. */
export function canManagePromptLibrary(context: JournalAccessContext): boolean {
  if (!context.actorPersonId) return false;
  return context.assignments.some((a) => ADMIN_ROLE_TYPES.has(a.roleType));
}

/** Staff (admin, coach, assistant coach) can read the active prompt library. */
export function canReadPromptLibrary(context: JournalAccessContext): boolean {
  if (!context.actorPersonId) return false;
  return context.assignments.some((a) => STAFF_ROLE_TYPES.has(a.roleType) || a.roleType === RoleType.ATHLETE);
}

// ── Prompt assignment ────────────────────────────────────────────────────────

/**
 * Coaches and staff can assign prompts to athletes or teams.
 * Athletes cannot assign prompts to others.
 */
export function canAssignPrompt(context: JournalAccessContext): boolean {
  if (!context.actorPersonId) return false;
  return context.assignments.some((a) => STAFF_ROLE_TYPES.has(a.roleType));
}

/**
 * Athletes can see their own assignments.
 * Staff can see all assignments in scope.
 * Guardians can see assignments for their linked athletes only.
 */
export function canReadAssignment(
  context: JournalAccessContext,
  assignment: PromptAssignmentContext,
): boolean {
  if (!context.actorPersonId) return false;

  // Staff can read any assignment in the organization
  if (context.assignments.some((a) => STAFF_ROLE_TYPES.has(a.roleType))) return true;

  // Athlete can see their own assignment
  if (
    assignment.assignedToAthletePersonId &&
    context.actorPersonId === assignment.assignedToAthletePersonId
  ) {
    return true;
  }

  // Guardian can see assignments for their linked athletes
  if (
    assignment.assignedToAthletePersonId &&
    context.linkedGuardianAthleteIds.has(assignment.assignedToAthletePersonId)
  ) {
    return true;
  }

  return false;
}

/**
 * Only the assigning staff or admins can cancel an assignment.
 */
export function canCancelAssignment(
  context: JournalAccessContext,
  assignment: PromptAssignmentContext,
): boolean {
  if (!context.actorPersonId) return false;
  if (context.assignments.some((a) => ADMIN_ROLE_TYPES.has(a.roleType))) return true;
  if (context.actorPersonId === assignment.assignedByPersonId) return true;
  return false;
}

/**
 * An athlete can respond to an assignment that is ACTIVE or PENDING and
 * is addressed to them or their team.
 * This checks only the actor-to-assignment relationship, not team membership.
 */
export function canRespondToAssignment(
  context: JournalAccessContext,
  assignment: PromptAssignmentContext,
  actorTeamIds: string[],
): boolean {
  if (!context.actorPersonId) return false;

  const isActiveOrPending =
    assignment.status === JournalAssignmentStatus.ACTIVE ||
    assignment.status === JournalAssignmentStatus.PENDING;
  if (!isActiveOrPending) return false;

  // Direct athlete assignment — actor must be an athlete
  if (
    assignment.assignedToAthletePersonId &&
    context.actorPersonId === assignment.assignedToAthletePersonId &&
    context.assignments.some((a) => a.roleType === RoleType.ATHLETE)
  ) {
    return true;
  }

  // Team assignment — actor must be on the team
  if (assignment.assignedToTeamId && actorTeamIds.includes(assignment.assignedToTeamId)) {
    // Must be an athlete role
    if (context.assignments.some((a) => a.roleType === RoleType.ATHLETE)) return true;
  }

  return false;
}

// ── Safe activity text ───────────────────────────────────────────────────────

export function deriveSafePromptActivityText(action: string): string {
  if (action === "journal.prompt_assigned") return "Journal prompt assigned";
  if (action === "journal.prompt_response_submitted") return "Journal prompt completed";
  if (action === "journal.prompt_assignment_cancelled") return "Prompt assignment cancelled";
  return "Journal prompt activity";
}

// ── Assignment status helpers ────────────────────────────────────────────────

export function labelForAssignmentStatus(status: JournalAssignmentStatus): string {
  switch (status) {
    case JournalAssignmentStatus.PENDING:
      return "Pending";
    case JournalAssignmentStatus.ACTIVE:
      return "Active";
    case JournalAssignmentStatus.COMPLETED:
      return "Completed";
    case JournalAssignmentStatus.CANCELLED:
      return "Cancelled";
    case JournalAssignmentStatus.EXPIRED:
      return "Expired";
    default:
      return String(status);
  }
}

export function isAssignmentOpen(status: JournalAssignmentStatus): boolean {
  return (
    status === JournalAssignmentStatus.ACTIVE || status === JournalAssignmentStatus.PENDING
  );
}

export function computeAssignmentDueState(
  status: JournalAssignmentStatus,
  dueAt: Date | null,
  now: Date,
): "overdue" | "due_soon" | "open" | "closed" {
  if (!isAssignmentOpen(status)) return "closed";
  if (!dueAt) return "open";
  const msUntilDue = dueAt.getTime() - now.getTime();
  if (msUntilDue < 0) return "overdue";
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (msUntilDue < threeDaysMs) return "due_soon";
  return "open";
}
