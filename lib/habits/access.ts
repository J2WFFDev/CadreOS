/**
 * Arc 23D / Arc 24D.8 — Habit Model, Recurrence, and Completion Tracking
 *
 * Authorization helpers for the Habit, HabitSchedule, and HabitCompletion models.
 * These are pure functions — no DB dependencies — and are fully testable.
 *
 * Role policy summary:
 * - ORGANIZATION_ADMIN / PROGRAM_DIRECTOR: full habit management
 * - COACH / ASSISTANT_COACH: can create and manage habits for athletes in their scope
 * - ATHLETE: can create and manage their own habits, and check in on any habit assigned to them
 * - PARENT_GUARDIAN: can view habit summaries (count/streak) for related athletes only
 */

import { HabitStatus, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

type RoleAssignmentScope = {
  roleType: RoleType;
  scopeType: ScopeType;
  teamId: string | null;
  programId: string | null;
};

export type HabitAccessContext = {
  actorPersonId: string | null;
  assignments: RoleAssignmentScope[];
  linkedGuardianAthleteIds: Set<string>;
};

export type HabitRecord = {
  id: string;
  athletePersonId: string;
  assignedToTeamId: string | null;
  createdByPersonId: string;
  status: HabitStatus;
  teamProgramId?: string | null;
};

const ADMIN_ROLE_TYPES = new Set<RoleType>([RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR]);
const STAFF_ROLE_TYPES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
]);

export async function resolveHabitAccessContext(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<HabitAccessContext> {
  if (!input.actorPersonId) {
    return {
      actorPersonId: null,
      assignments: [],
      linkedGuardianAthleteIds: new Set<string>(),
    };
  }

  const assignments = await db.roleAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      personId: input.actorPersonId,
    },
    select: {
      roleType: true,
      scopeType: true,
      teamId: true,
      programId: true,
    },
  });

  const guardianRelationships = await db.athleteGuardianRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      guardianPersonId: input.actorPersonId,
    },
    select: { athletePersonId: true },
  });

  return {
    actorPersonId: input.actorPersonId,
    assignments,
    linkedGuardianAthleteIds: new Set(guardianRelationships.map((r) => r.athletePersonId)),
  };
}

function hasScopedAssignment(
  assignments: RoleAssignmentScope[],
  roleTypes: Set<RoleType>,
  input: { teamId: string | null; teamProgramId?: string | null },
): boolean {
  return assignments.some((a) => {
    if (!roleTypes.has(a.roleType)) return false;
    if (a.scopeType === ScopeType.ORGANIZATION) return true;
    if (a.scopeType === ScopeType.TEAM) {
      return Boolean(input.teamId && a.teamId && input.teamId === a.teamId);
    }
    if (a.scopeType === ScopeType.PROGRAM) {
      return Boolean(input.teamProgramId && a.programId && input.teamProgramId === a.programId);
    }
    return false;
  });
}

export function hasHabitAdminAccess(context: HabitAccessContext): boolean {
  return context.assignments.some((a) => ADMIN_ROLE_TYPES.has(a.roleType));
}

/** Admin, director, coach, assistant-coach, or athlete can create habits. */
export function canCreateHabit(context: HabitAccessContext): boolean {
  if (!context.actorPersonId) return false;
  return context.assignments.some(
    (a) => STAFF_ROLE_TYPES.has(a.roleType) || a.roleType === RoleType.ATHLETE,
  );
}

/** Existing staff roles may assign a Habit to another Athlete or a single team. */
export function canAssignHabitToOthers(context: HabitAccessContext): boolean {
  if (!context.actorPersonId) return false;
  return context.assignments.some((assignment) => STAFF_ROLE_TYPES.has(assignment.roleType));
}

export function isHabitAssignmentAllowed(
  context: HabitAccessContext,
  assignment: { athletePersonId: string; assignedToTeamId: string | null },
): boolean {
  if (!context.actorPersonId || !assignment.athletePersonId) return false;
  if (canAssignHabitToOthers(context)) return true;
  return assignment.athletePersonId === context.actorPersonId && assignment.assignedToTeamId === null;
}

/** My Habits contains only definitions whose subject is the current actor. */
export function isHabitInMyHabits(context: HabitAccessContext, habit: Pick<HabitRecord, "athletePersonId">): boolean {
  return Boolean(context.actorPersonId && habit.athletePersonId === context.actorPersonId);
}

/**
 * A habit is readable if:
 * - the actor is org admin/director
 * - the actor created the habit
 * - the actor is the habit's athlete
 * - the actor is a scoped coach/assistant-coach for the habit's team/program
 * - the actor is a guardian linked to the habit's athlete (summary-level access)
 */
export function canReadHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (hasHabitAdminAccess(context)) return true;
  if (habit.createdByPersonId === context.actorPersonId) return true;
  if (habit.athletePersonId === context.actorPersonId) return true;

  if (
    hasScopedAssignment(context.assignments, new Set([RoleType.COACH, RoleType.ASSISTANT_COACH]), {
      teamId: habit.assignedToTeamId,
      teamProgramId: habit.teamProgramId,
    })
  ) {
    return true;
  }

  // Guardians can view habit summary for related athletes
  if (context.linkedGuardianAthleteIds.has(habit.athletePersonId)) return true;

  return false;
}

/**
 * A habit is editable by the admin, or by the person who created it (if they are staff or the
 * habit's athlete), or by a scoped coach who created the habit.
 */
export function canEditHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.status === HabitStatus.ARCHIVED) return false;
  if (hasHabitAdminAccess(context)) return true;
  if (habit.createdByPersonId === context.actorPersonId) return true;
  return false;
}

/** Admin or the creator can archive a habit that isn't already archived. */
export function canArchiveHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.status === HabitStatus.ARCHIVED) return false;
  if (hasHabitAdminAccess(context)) return true;
  if (habit.createdByPersonId === context.actorPersonId) return true;
  return false;
}

/** Admin or the creator can pause/resume an active or paused habit. COMPLETED/ARCHIVED habits cannot be paused. */
export function canPauseHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.status === HabitStatus.ARCHIVED) return false;
  if (habit.status === HabitStatus.COMPLETED) return false;
  if (hasHabitAdminAccess(context)) return true;
  if (habit.createdByPersonId === context.actorPersonId) return true;
  return false;
}

/**
 * Habit check-in is allowed for:
 * - the habit's own athlete
 * - org admin/director (on behalf of athlete)
 * Only ACTIVE habits can receive check-ins.
 */
export function canCheckInHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.status !== HabitStatus.ACTIVE) return false;
  if (habit.athletePersonId === context.actorPersonId) return true;
  if (hasHabitAdminAccess(context)) return true;
  return false;
}

/**
 * Arc 24D.8: Complete the habit lifecycle (mark the habit itself as COMPLETED).
 * Distinct from completing an occurrence/check-in.
 * Only ACTIVE or PAUSED habits can be lifecycle-completed.
 */
export function canCompleteHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.status === HabitStatus.ARCHIVED) return false;
  if (habit.status === HabitStatus.COMPLETED) return false;
  if (hasHabitAdminAccess(context)) return true;
  if (habit.createdByPersonId === context.actorPersonId) return true;
  return false;
}

/**
 * Arc 24D.8: Restore an archived or completed habit back to ACTIVE.
 * Only admins or the original creator can restore.
 */
export function canRestoreHabit(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.status !== HabitStatus.ARCHIVED && habit.status !== HabitStatus.COMPLETED) return false;
  if (hasHabitAdminAccess(context)) return true;
  if (habit.createdByPersonId === context.actorPersonId) return true;
  return false;
}

/**
 * Completion detail (full history with notes) is visible to:
 * - the habit's athlete
 * - org admin/director
 * Guardians and coaches see summary only (count/streak) — not per-completion notes.
 */
export function canReadCompletionDetail(context: HabitAccessContext, habit: HabitRecord): boolean {
  if (!context.actorPersonId) return false;
  if (habit.athletePersonId === context.actorPersonId) return true;
  if (hasHabitAdminAccess(context)) return true;
  return false;
}
