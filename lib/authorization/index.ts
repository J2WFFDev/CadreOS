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

import { NoteVisibility, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import { MEMBEROPS_STAFF_ROLE_TYPES } from "@/lib/member-ops";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Role types that carry staff-level access within an organization.
 * PARENT_GUARDIAN and ATHLETE are excluded — they have no staff capabilities.
 */
const STAFF_ROLE_TYPES = new Set<RoleType>([
  ...MEMBEROPS_STAFF_ROLE_TYPES,
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

export type StaffScopeResolution = {
  allowAllStaffScope: boolean;
  allowedTeamIds: string[];
  allowedProgramIds: string[];
  hasAmbiguousScopeAssignments: boolean;
  hasExplicitScopedAccess: boolean;
};

export type AuthorizationDecisionHelper =
  | "canReadStaffOnlyContent"
  | "canReadTeamScopedContent"
  | "canReadPersonOperationalContent"
  | "canAccessFollowUpTask"
  | "canReadObservationNoteByVisibility";

export type AuthorizationDecisionScope =
  | "none"
  | "organization"
  | "team"
  | "program"
  | "self_assignee"
  | "self_creator";

export type AuthorizationOwnershipRelationship =
  | "staff_role"
  | "assignee"
  | "creator"
  | "none"
  | "unlinked_account";

export type AuthorizationDecisionReasonCode =
  | "ALLOW_STAFF_ROLE"
  | "ALLOW_ORG_LEVEL_CONTENT"
  | "ALLOW_ORGANIZATION_SCOPE_ASSIGNMENT"
  | "ALLOW_TEAM_SCOPE_ASSIGNMENT_MATCH"
  | "ALLOW_PROGRAM_SCOPE_ASSIGNMENT_MATCH"
  | "ALLOW_TASK_ASSIGNEE"
  | "ALLOW_TASK_CREATOR"
  | "DENY_UNLINKED_ACCOUNT"
  | "DENY_NON_STAFF_ROLE"
  | "DENY_TEAM_SCOPE_MISMATCH"
  | "DENY_PROGRAM_SCOPE_TEAM_UNVERIFIED"
  | "DENY_PERSON_SCOPE_MISMATCH"
  | "DENY_PERSON_SCOPE_UNRESOLVED"
  | "DENY_ORG_LEVEL_SCOPE_UNVERIFIED"
  | "DENY_NOTE_VISIBILITY_UNSUPPORTED"
  | "DENY_TASK_NO_OWNERSHIP";

export type AuthorizationDecision = {
  helper: AuthorizationDecisionHelper;
  allowed: boolean;
  reasonCode: AuthorizationDecisionReasonCode;
  reason: string;
  scopeApplied: AuthorizationDecisionScope;
  ownershipRelationship: AuthorizationOwnershipRelationship;
  organizationId: string;
  actorPersonId: string | null;
  evaluatedTeamId: string | null;
  matchedRoleAssignment:
    | {
        roleType: RoleType;
        scopeType: ScopeType;
        programId: string | null;
        teamId: string | null;
      }
    | null;
};

type AuthorizationDecisionLogInput = {
  workflow: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
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
  const decision = evaluateStaffOnlyContentAccess(context);
  logAuthorizationDecision(decision, {
    workflow: "authorization-helper",
    metadata: { helper: decision.helper },
  });
  return decision.allowed;
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
export function canReadTeamScopedContent(
  context: ActorRoleContext,
  teamId: string | null,
  teamProgramId: string | null = null,
): boolean {
  const decision = evaluateTeamScopedContentAccess(context, teamId, teamProgramId);
  logAuthorizationDecision(decision, {
    workflow: "authorization-helper",
    metadata: { helper: decision.helper },
  });
  return decision.allowed;
}

export function canReadObservationNoteByVisibility(
  context: ActorRoleContext,
  visibility: NoteVisibility | null | undefined,
): boolean {
  const decision = evaluateObservationNoteVisibilityAccess(context, visibility);
  logAuthorizationDecision(decision, {
    workflow: "authorization-helper",
    metadata: { helper: decision.helper },
  });
  return decision.allowed;
}

export function canReadPersonOperationalContent(
  context: ActorRoleContext,
  personScope: { teamIds: string[]; programIds: string[] },
): boolean {
  const decision = evaluatePersonOperationalContentAccess(context, personScope);
  logAuthorizationDecision(decision, {
    workflow: "authorization-helper",
    metadata: { helper: decision.helper },
  });
  return decision.allowed;
}

export function evaluateStaffOnlyContentAccess(context: ActorRoleContext): AuthorizationDecision {
  if (!context.actorPersonId) {
    return {
      helper: "canReadStaffOnlyContent",
      allowed: false,
      reasonCode: "DENY_UNLINKED_ACCOUNT",
      reason: "Actor account is not linked to a person record.",
      scopeApplied: "none",
      ownershipRelationship: "unlinked_account",
      organizationId: context.organizationId,
      actorPersonId: null,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  if (!context.isStaffMember) {
    return {
      helper: "canReadStaffOnlyContent",
      allowed: false,
      reasonCode: "DENY_NON_STAFF_ROLE",
      reason: "Actor has no staff role assignment in this organization.",
      scopeApplied: "none",
      ownershipRelationship: "none",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  return {
    helper: "canReadStaffOnlyContent",
    allowed: true,
    reasonCode: "ALLOW_STAFF_ROLE",
    reason: "Actor has staff role assignment in this organization.",
    scopeApplied: "organization",
    ownershipRelationship: "staff_role",
    organizationId: context.organizationId,
    actorPersonId: context.actorPersonId,
    evaluatedTeamId: null,
    matchedRoleAssignment: null,
  };
}

export function evaluateTeamScopedContentAccess(
  context: ActorRoleContext,
  teamId: string | null,
  teamProgramId: string | null = null,
): AuthorizationDecision {
  if (!context.isStaffMember) {
    return {
      helper: "canReadTeamScopedContent",
      allowed: false,
      reasonCode: context.actorPersonId ? "DENY_NON_STAFF_ROLE" : "DENY_UNLINKED_ACCOUNT",
      reason: context.actorPersonId
        ? "Actor has no staff role assignment in this organization."
        : "Actor account is not linked to a person record.",
      scopeApplied: "none",
      ownershipRelationship: context.actorPersonId ? "none" : "unlinked_account",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: teamId,
      matchedRoleAssignment: null,
    };
  }

  // Org-level records are accessible to all staff.
  if (!teamId) {
    const organizationAssignment = context.staffRoleAssignments.find(
      (assignment) => assignment.scopeType === ScopeType.ORGANIZATION,
    );

    if (!organizationAssignment) {
      return {
        helper: "canReadTeamScopedContent",
        allowed: false,
        reasonCode: "DENY_ORG_LEVEL_SCOPE_UNVERIFIED",
        reason:
          "Record is organization-scoped (no teamId), but actor has no organization-scope assignment; denying by default.",
        scopeApplied: "none",
        ownershipRelationship: "staff_role",
        organizationId: context.organizationId,
        actorPersonId: context.actorPersonId,
        evaluatedTeamId: null,
        matchedRoleAssignment: null,
      };
    }

    return {
      helper: "canReadTeamScopedContent",
      allowed: true,
      reasonCode: "ALLOW_ORG_LEVEL_CONTENT",
      reason: "Record is organization-scoped (no teamId) and actor has organization-scope staff access.",
      scopeApplied: "organization",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: organizationAssignment,
    };
  }

  const organizationAssignment = context.staffRoleAssignments.find(
    (assignment) => assignment.scopeType === ScopeType.ORGANIZATION,
  );

  if (organizationAssignment) {
    return {
      helper: "canReadTeamScopedContent",
      allowed: true,
      reasonCode: "ALLOW_ORGANIZATION_SCOPE_ASSIGNMENT",
      reason: "Actor has organization-scope staff assignment covering all teams.",
      scopeApplied: "organization",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: teamId,
      matchedRoleAssignment: organizationAssignment,
    };
  }

  const teamAssignment = context.staffRoleAssignments.find(
    (assignment) => assignment.scopeType === ScopeType.TEAM && assignment.teamId === teamId,
  );

  if (teamAssignment) {
    return {
      helper: "canReadTeamScopedContent",
      allowed: true,
      reasonCode: "ALLOW_TEAM_SCOPE_ASSIGNMENT_MATCH",
      reason: "Actor has team-scope staff assignment matching this team.",
      scopeApplied: "team",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: teamId,
      matchedRoleAssignment: teamAssignment,
    };
  }

  const programAssignment = context.staffRoleAssignments.find(
    (assignment) =>
      assignment.scopeType === ScopeType.PROGRAM &&
      assignment.programId &&
      teamProgramId &&
      assignment.programId === teamProgramId,
  );

  if (programAssignment) {
    return {
      helper: "canReadTeamScopedContent",
      allowed: true,
      reasonCode: "ALLOW_PROGRAM_SCOPE_ASSIGNMENT_MATCH",
      reason: "Actor has program-scope staff assignment matching the resolved team program.",
      scopeApplied: "program",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: teamId,
      matchedRoleAssignment: programAssignment,
    };
  }

  const hasProgramScopedAssignment = context.staffRoleAssignments.some(
    (assignment) => assignment.scopeType === ScopeType.PROGRAM,
  );

  if (hasProgramScopedAssignment && !teamProgramId) {
    return {
      helper: "canReadTeamScopedContent",
      allowed: false,
      reasonCode: "DENY_PROGRAM_SCOPE_TEAM_UNVERIFIED",
      reason:
        "Program-scope assignment exists, but team-to-program mapping is unresolved; denying by default.",
      scopeApplied: "none",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: teamId,
      matchedRoleAssignment: null,
    };
  }

  return {
    helper: "canReadTeamScopedContent",
    allowed: false,
    reasonCode: "DENY_TEAM_SCOPE_MISMATCH",
    reason: "Actor is staff but has no scope assignment matching this team.",
    scopeApplied: "none",
    ownershipRelationship: "staff_role",
    organizationId: context.organizationId,
    actorPersonId: context.actorPersonId,
    evaluatedTeamId: teamId,
    matchedRoleAssignment: null,
  };
}

export function evaluateObservationNoteVisibilityAccess(
  context: ActorRoleContext,
  visibility: NoteVisibility | null | undefined,
): AuthorizationDecision {
  if (!visibility || visibility !== NoteVisibility.STAFF_ONLY) {
    return {
      helper: "canReadObservationNoteByVisibility",
      allowed: false,
      reasonCode: "DENY_NOTE_VISIBILITY_UNSUPPORTED",
      reason:
        "ObservationNote visibility is unresolved or unsupported for this workflow; denying by default.",
      scopeApplied: "none",
      ownershipRelationship: "none",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  const base = evaluateStaffOnlyContentAccess(context);
  return {
    ...base,
    helper: "canReadObservationNoteByVisibility",
  };
}

export function evaluatePersonOperationalContentAccess(
  context: ActorRoleContext,
  personScope: { teamIds: string[]; programIds: string[] },
): AuthorizationDecision {
  if (!context.isStaffMember) {
    return {
      helper: "canReadPersonOperationalContent",
      allowed: false,
      reasonCode: context.actorPersonId ? "DENY_NON_STAFF_ROLE" : "DENY_UNLINKED_ACCOUNT",
      reason: context.actorPersonId
        ? "Actor has no staff role assignment in this organization."
        : "Actor account is not linked to a person record.",
      scopeApplied: "none",
      ownershipRelationship: context.actorPersonId ? "none" : "unlinked_account",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  const organizationAssignment = context.staffRoleAssignments.find(
    (assignment) => assignment.scopeType === ScopeType.ORGANIZATION,
  );

  if (organizationAssignment) {
    return {
      helper: "canReadPersonOperationalContent",
      allowed: true,
      reasonCode: "ALLOW_ORGANIZATION_SCOPE_ASSIGNMENT",
      reason: "Actor has organization-scope staff assignment covering this person workflow.",
      scopeApplied: "organization",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: organizationAssignment,
    };
  }

  const uniqueTeamIds = Array.from(new Set(personScope.teamIds.filter(Boolean)));
  const uniqueProgramIds = Array.from(new Set(personScope.programIds.filter(Boolean)));

  const teamAssignment = context.staffRoleAssignments.find(
    (assignment) =>
      assignment.scopeType === ScopeType.TEAM &&
      assignment.teamId &&
      uniqueTeamIds.includes(assignment.teamId),
  );

  if (teamAssignment) {
    return {
      helper: "canReadPersonOperationalContent",
      allowed: true,
      reasonCode: "ALLOW_TEAM_SCOPE_ASSIGNMENT_MATCH",
      reason: "Actor has team-scope staff assignment overlapping this person's operational scope.",
      scopeApplied: "team",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: teamAssignment.teamId,
      matchedRoleAssignment: teamAssignment,
    };
  }

  const programAssignment = context.staffRoleAssignments.find(
    (assignment) =>
      assignment.scopeType === ScopeType.PROGRAM &&
      assignment.programId &&
      uniqueProgramIds.includes(assignment.programId),
  );

  if (programAssignment) {
    return {
      helper: "canReadPersonOperationalContent",
      allowed: true,
      reasonCode: "ALLOW_PROGRAM_SCOPE_ASSIGNMENT_MATCH",
      reason: "Actor has program-scope staff assignment overlapping this person's operational scope.",
      scopeApplied: "program",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: programAssignment,
    };
  }

  if (uniqueTeamIds.length === 0 && uniqueProgramIds.length === 0) {
    return {
      helper: "canReadPersonOperationalContent",
      allowed: false,
      reasonCode: "DENY_PERSON_SCOPE_UNRESOLVED",
      reason:
        "Person operational scope has no resolved team or program context; denying non-organization staff by default.",
      scopeApplied: "none",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  return {
    helper: "canReadPersonOperationalContent",
    allowed: false,
    reasonCode: "DENY_PERSON_SCOPE_MISMATCH",
    reason: "Actor is staff but has no team/program assignment overlapping this person's operational scope.",
    scopeApplied: "none",
    ownershipRelationship: "staff_role",
    organizationId: context.organizationId,
    actorPersonId: context.actorPersonId,
    evaluatedTeamId: null,
    matchedRoleAssignment: null,
  };
}

export function resolveStaffScopeResolution(context: ActorRoleContext): StaffScopeResolution {
  const hasOrganizationScopeAssignment = context.staffRoleAssignments.some(
    (assignment) => assignment.scopeType === ScopeType.ORGANIZATION,
  );

  if (hasOrganizationScopeAssignment) {
    return {
      allowAllStaffScope: true,
      allowedTeamIds: [],
      allowedProgramIds: [],
      hasAmbiguousScopeAssignments: false,
      hasExplicitScopedAccess: true,
    };
  }

  const allowedTeamIds = Array.from(
    new Set(
      context.staffRoleAssignments
        .filter((assignment) => assignment.scopeType === ScopeType.TEAM)
        .map((assignment) => assignment.teamId)
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  );
  const allowedProgramIds = Array.from(
    new Set(
      context.staffRoleAssignments
        .filter((assignment) => assignment.scopeType === ScopeType.PROGRAM)
        .map((assignment) => assignment.programId)
        .filter((programId): programId is string => Boolean(programId)),
    ),
  );
  const hasAmbiguousScopeAssignments = context.staffRoleAssignments.some(
    (assignment) =>
      (assignment.scopeType === ScopeType.TEAM && !assignment.teamId) ||
      (assignment.scopeType === ScopeType.PROGRAM && !assignment.programId),
  );

  return {
    allowAllStaffScope: false,
    allowedTeamIds,
    allowedProgramIds,
    hasAmbiguousScopeAssignments,
    hasExplicitScopedAccess: allowedTeamIds.length > 0 || allowedProgramIds.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Task access helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the actor may read a specific FollowUpTask.
 *
 * Access rules:
 * - All staff members may read any task in their organization.
 * - Non-staff actors are denied until a guardian/athlete task-detail policy is
 *   intentionally designed and implemented end-to-end.
 *
 * Returns false when actorPersonId is null (unlinked account).
 */
export function canAccessFollowUpTask(
  context: ActorRoleContext,
  task: { assigneePersonId: string; createdByPersonId: string },
): boolean {
  const decision = evaluateFollowUpTaskAccess(context, task);
  logAuthorizationDecision(decision, {
    workflow: "authorization-helper",
    metadata: { helper: decision.helper },
  });
  return decision.allowed;
}

export function evaluateFollowUpTaskAccess(
  context: ActorRoleContext,
  _task: { assigneePersonId: string; createdByPersonId: string },
): AuthorizationDecision {
  void _task;

  if (context.isStaffMember) {
    return {
      helper: "canAccessFollowUpTask",
      allowed: true,
      reasonCode: "ALLOW_STAFF_ROLE",
      reason: "Actor has staff role assignment and may access organization tasks.",
      scopeApplied: "organization",
      ownershipRelationship: "staff_role",
      organizationId: context.organizationId,
      actorPersonId: context.actorPersonId,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  if (!context.actorPersonId) {
    return {
      helper: "canAccessFollowUpTask",
      allowed: false,
      reasonCode: "DENY_UNLINKED_ACCOUNT",
      reason: "Actor account is not linked to a person record.",
      scopeApplied: "none",
      ownershipRelationship: "unlinked_account",
      organizationId: context.organizationId,
      actorPersonId: null,
      evaluatedTeamId: null,
      matchedRoleAssignment: null,
    };
  }

  return {
    helper: "canAccessFollowUpTask",
    allowed: false,
    reasonCode: "DENY_TASK_NO_OWNERSHIP",
    reason:
      "Task detail access requires a staff role assignment until non-staff task visibility is intentionally designed.",
    scopeApplied: "none",
    ownershipRelationship: "none",
    organizationId: context.organizationId,
    actorPersonId: context.actorPersonId,
    evaluatedTeamId: null,
    matchedRoleAssignment: null,
  };
}

function isAuthorizationAuditLogEnabled(): boolean {
  const rawValue = process.env.CADREOS_AUTH_AUDIT_LOG?.toLowerCase();
  return rawValue === "1" || rawValue === "true" || rawValue === "yes" || rawValue === "on";
}

export function logAuthorizationDecision(
  decision: AuthorizationDecision,
  input: AuthorizationDecisionLogInput,
): void {
  if (!isAuthorizationAuditLogEnabled()) {
    return;
  }

  console.info(
    "[cadreos.authz]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      workflow: input.workflow,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      decision,
    }),
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
