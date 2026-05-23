/**
 * Phase 9E — Runtime Authorization Helper Foundation
 *
 * Reusable, testable authorization helpers for current operational models
 * (ObservationNote, FollowUpTask, organization/program/team scoping).
 *
 * Design principles:
 * - Helpers are pure functions that operate on a resolved ActorRoleContext.
 * - A single DB call (resolveActorRoleContext) loads all role assignments needed
 *   for the current request; downstream helpers are synchronous after that.
 * - No Entry model behavior — this foundation targets existing models only.
 * - Guardian-linked access is NOT implemented here; it is deferred per Phase 9D
 *   until a guardian-facing read path and consent framework exist.
 *
 * @see planning/PHASE_9D_ENTRY_VISIBILITY_ACCESS_POLICY.md
 * @see planning/PHASE_9E_RUNTIME_AUTHORIZATION_HELPER_FOUNDATION.md
 */

import { RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Role types that carry staff-level access within an organization.
 * PARENT_GUARDIAN and ATHLETE are excluded — they have no staff capabilities.
 */
const STAFF_ROLE_TYPES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffRoleAssignment = {
  roleType: RoleType;
  scopeType: ScopeType;
  programId: string | null;
  teamId: string | null;
};

/**
 * The resolved role context for an actor within an organization.
 * Produced by resolveActorRoleContext() and consumed by all downstream helpers.
 */
export type ActorRoleContext = {
  organizationId: string;
  actorPersonId: string | null;
  /** All staff-role assignments for this actor in this organization. */
  staffRoleAssignments: StaffRoleAssignment[];
  /**
   * True if the actor holds ORGANIZATION_ADMIN at ORGANIZATION scope.
   * Org admins have the broadest access and bypass team/program scope matching.
   */
  isOrganizationAdmin: boolean;
  /**
   * True if the actor holds any staff role (org admin, program director, coach,
   * or assistant coach). PARENT_GUARDIAN and ATHLETE are not staff.
   */
  isStaffMember: boolean;
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AuthorizationDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationDeniedError";
  }
}

// ---------------------------------------------------------------------------
// Context resolution
// ---------------------------------------------------------------------------

/**
 * Resolves and returns the actor's role context for the given organization.
 *
 * This is the single DB call that loads all role data needed for downstream
 * authorization decisions. Call once per request and pass the result to helpers.
 *
 * Returns an unauthenticated/zero-access context when actorPersonId is null.
 */
export async function resolveActorRoleContext(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<ActorRoleContext> {
  if (!input.actorPersonId) {
    return {
      organizationId: input.organizationId,
      actorPersonId: null,
      staffRoleAssignments: [],
      isOrganizationAdmin: false,
      isStaffMember: false,
    };
  }

  const assignments = await db.roleAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      personId: input.actorPersonId,
      roleType: { in: [...STAFF_ROLE_TYPES] },
    },
    select: {
      roleType: true,
      scopeType: true,
      programId: true,
      teamId: true,
    },
  });

  const isOrganizationAdmin = assignments.some(
    (a) => a.roleType === RoleType.ORGANIZATION_ADMIN && a.scopeType === ScopeType.ORGANIZATION,
  );

  return {
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    staffRoleAssignments: assignments,
    isOrganizationAdmin,
    isStaffMember: assignments.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Staff access helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the actor may read STAFF_ONLY content (e.g., ObservationNotes).
 *
 * STAFF_ONLY records are accessible to all staff role holders
 * (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, ASSISTANT_COACH).
 * PARENT_GUARDIAN and ATHLETE users must not read STAFF_ONLY content.
 */
export function canReadStaffOnlyContent(context: ActorRoleContext): boolean {
  return context.isStaffMember;
}

/**
 * Returns true if the actor has staff read access scoped to the given team.
 *
 * Access rules:
 * - Org-level records (teamId = null): accessible to all staff members.
 * - ORGANIZATION_ADMIN at ORGANIZATION scope: allowed unconditionally.
 * - Any staff member at ORGANIZATION scope (e.g. org-scoped program director): allowed.
 * - Staff with TEAM scope: allowed only if assignment.teamId === teamId.
 * - Staff with PROGRAM scope: conservatively allowed (team-to-program mapping
 *   is not verified here; a stricter check would require an additional DB lookup).
 *
 * Non-staff actors always return false.
 */
export function canReadTeamScopedContent(context: ActorRoleContext, teamId: string | null): boolean {
  if (!context.isStaffMember) {
    return false;
  }

  // Org-level records are accessible to all staff.
  if (!teamId) {
    return true;
  }

  return context.staffRoleAssignments.some((assignment) => {
    // ORGANIZATION scope assignments (including org admin) cover all teams.
    if (assignment.scopeType === ScopeType.ORGANIZATION) {
      return true;
    }

    // TEAM scope: exact match required.
    if (assignment.scopeType === ScopeType.TEAM) {
      return assignment.teamId === teamId;
    }

    // PROGRAM scope: conservatively allow; callers that need strict enforcement
    // should verify team.programId === assignment.programId with a DB lookup.
    return assignment.scopeType === ScopeType.PROGRAM;
  });
}

// ---------------------------------------------------------------------------
// Task access helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the actor may read a specific FollowUpTask.
 *
 * Access rules:
 * - All staff members may read any task in their organization.
 * - Non-staff actors may read a task only if they are the assignee or creator.
 *   (This supports a future pattern where tasks could be assigned to athletes
 *    or non-staff persons; currently all actors with a person link are staff.)
 *
 * Returns false when actorPersonId is null (unlinked account).
 */
export function canAccessFollowUpTask(
  context: ActorRoleContext,
  task: { assigneePersonId: string; createdByPersonId: string },
): boolean {
  if (context.isStaffMember) {
    return true;
  }

  if (!context.actorPersonId) {
    return false;
  }

  return (
    context.actorPersonId === task.assigneePersonId ||
    context.actorPersonId === task.createdByPersonId
  );
}

// ---------------------------------------------------------------------------
// Assertion helpers (throw on denial)
// ---------------------------------------------------------------------------

/**
 * Throws AuthorizationDeniedError if the actor does not have staff access.
 * Use on write routes and detail pages where non-staff access must be blocked.
 */
export function assertStaffAccess(context: ActorRoleContext): void {
  if (!context.actorPersonId) {
    throw new AuthorizationDeniedError(
      "Your account is not linked to a person record. Link your person at /account/link-person.",
    );
  }

  if (!context.isStaffMember) {
    throw new AuthorizationDeniedError(
      "You do not have a staff role assignment that allows access to this resource.",
    );
  }
}

/**
 * Throws AuthorizationDeniedError if the actor does not hold ORGANIZATION_ADMIN
 * at ORGANIZATION scope. Use for admin-only management surfaces.
 */
export function assertOrganizationAdminAccess(context: ActorRoleContext): void {
  if (!context.actorPersonId) {
    throw new AuthorizationDeniedError(
      "Your account is not linked to a person record. Link your person at /account/link-person.",
    );
  }

  if (!context.isOrganizationAdmin) {
    throw new AuthorizationDeniedError(
      "Organization admin access is required for this action.",
    );
  }
}
