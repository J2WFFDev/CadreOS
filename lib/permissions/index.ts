import { OrgStatus, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

type SupportedAction =
  | "program.create"
  | "program.update"
  | "season.create"
  | "season.update"
  | "person.create"
  | "person.update"
  | "person.activate"
  | "team.create"
  | "rosterMembership.create"
  | "rosterMembership.delete"
  | "roleAssignment.create"
  | "roleAssignment.delete"
  | "event.create"
  | "event.update"
  | "rsvp.upsert"
  | "attendance.upsert"
  | "note.create"
  | "note.update"
  | "task.create"
  | "task.update"
  | "booking.create"
  | "booking.approve"
  | "booking.deny"
  | "gearCategory.create"
  | "gearCategory.update"
  | "gearItem.create"
  | "gearItem.update"
  | "gearAssignment.create"
  | "gearAssignment.update"
  | "gearCheckout.create"
  | "gearCheckout.update"
  | "gearMaintenance.create"
  | "gearMaintenance.update"
  | "gearConsumableTransaction.create"
  | "gearConsumableTransaction.update";

type PermissionReason =
  | "UNAUTHENTICATED"
  | "ORGANIZATION_UNAVAILABLE"
  | "ORGANIZATION_INACTIVE"
  | "UNLINKED_ACCOUNT"
  | "UNSUPPORTED_ACTION"
  | "INSUFFICIENT_ROLE";

type PermissionScope = {
  programId: string | null;
  teamId: string | null;
};

const STAFF_ACTIONS_BY_ROLE: Record<RoleType, Set<SupportedAction>> = {
  [RoleType.ORGANIZATION_ADMIN]: new Set<SupportedAction>([
    "program.create",
    "program.update",
    "season.create",
    "season.update",
    "person.create",
    "person.update",
    "person.activate",
    "team.create",
    "rosterMembership.create",
    "rosterMembership.delete",
    "roleAssignment.create",
    "roleAssignment.delete",
    "event.create",
    "event.update",
    "rsvp.upsert",
    "attendance.upsert",
    "note.create",
    "note.update",
    "task.create",
    "task.update",
    "booking.create",
    "booking.approve",
    "booking.deny",
    "gearCategory.create",
    "gearCategory.update",
    "gearItem.create",
    "gearItem.update",
    "gearAssignment.create",
    "gearAssignment.update",
    "gearCheckout.create",
    "gearCheckout.update",
    "gearMaintenance.create",
    "gearMaintenance.update",
    "gearConsumableTransaction.create",
    "gearConsumableTransaction.update",
  ]),
  [RoleType.PROGRAM_DIRECTOR]: new Set<SupportedAction>([
    "season.create",
    "season.update",
    "team.create",
    "person.activate",
    "rosterMembership.create",
    "rosterMembership.delete",
    "event.create",
    "event.update",
    "rsvp.upsert",
    "attendance.upsert",
    "note.create",
    "note.update",
    "task.create",
    "task.update",
    "booking.create",
    "booking.approve",
    "booking.deny",
    "gearCategory.create",
    "gearCategory.update",
    "gearItem.create",
    "gearItem.update",
    "gearAssignment.create",
    "gearAssignment.update",
    "gearCheckout.create",
    "gearCheckout.update",
    "gearMaintenance.create",
    "gearMaintenance.update",
    "gearConsumableTransaction.create",
    "gearConsumableTransaction.update",
  ]),
  [RoleType.COACH]: new Set<SupportedAction>([
    "person.activate",
    "rosterMembership.create",
    "rosterMembership.delete",
    "event.create",
    "event.update",
    "rsvp.upsert",
    "attendance.upsert",
    "note.create",
    "note.update",
    "task.create",
    "task.update",
    "booking.create",
    "gearItem.create",
    "gearItem.update",
    "gearAssignment.create",
    "gearAssignment.update",
    "gearCheckout.create",
    "gearCheckout.update",
    "gearMaintenance.create",
    "gearMaintenance.update",
    "gearConsumableTransaction.create",
    "gearConsumableTransaction.update",
  ]),
  [RoleType.ASSISTANT_COACH]: new Set<SupportedAction>([
    "attendance.upsert",
    "note.create",
    "note.update",
    "task.create",
    "task.update",
  ]),
  [RoleType.PARENT_GUARDIAN]: new Set<SupportedAction>(),
  [RoleType.ATHLETE]: new Set<SupportedAction>(),
};

const SCOPED_ACTIONS = new Set<SupportedAction>([
  "season.create",
  "season.update",
  "team.create",
  "rosterMembership.create",
  "rosterMembership.delete",
  "event.create",
  "event.update",
  "rsvp.upsert",
  "attendance.upsert",
  "note.create",
  "note.update",
  "task.create",
  "task.update",
  "booking.create",
  "booking.approve",
  "booking.deny",
]);

const SUPPORTED_ACTIONS = new Set<SupportedAction>([
  "program.create",
  "program.update",
  "season.create",
  "season.update",
  "person.create",
  "person.update",
  "person.activate",
  "team.create",
  "rosterMembership.create",
  "rosterMembership.delete",
  "roleAssignment.create",
  "roleAssignment.delete",
  "event.create",
  "event.update",
  "rsvp.upsert",
  "attendance.upsert",
  "note.create",
  "note.update",
  "task.create",
  "task.update",
  "booking.create",
  "booking.approve",
  "booking.deny",
  "gearCategory.create",
  "gearCategory.update",
  "gearItem.create",
  "gearItem.update",
  "gearAssignment.create",
  "gearAssignment.update",
  "gearCheckout.create",
  "gearCheckout.update",
  "gearMaintenance.create",
  "gearMaintenance.update",
  "gearConsumableTransaction.create",
  "gearConsumableTransaction.update",
]);

export type PermissionCheckInput = {
  actorUserId: string | null;
  organizationId: string;
  action: string;
  programId?: string | null;
  teamId?: string | null;
  seasonId?: string | null;
  eventId?: string | null;
  noteId?: string | null;
  taskId?: string | null;
  roleAssignmentId?: string | null;
};

type PermissionDecision = {
  allowed: boolean;
  reason: PermissionReason;
  message: string;
};

export class PermissionDeniedError extends Error {
  reason: PermissionReason;

  constructor(reason: PermissionReason, message: string) {
    super(message);
    this.name = "PermissionDeniedError";
    this.reason = reason;
  }
}

function isSupportedAction(action: string): action is SupportedAction {
  return SUPPORTED_ACTIONS.has(action as SupportedAction);
}

async function resolvePermissionScope(input: PermissionCheckInput): Promise<PermissionScope> {
  let programId = input.programId ?? null;
  let teamId = input.teamId ?? null;

  if (input.seasonId && !programId) {
    const season = await db.season.findFirst({
      where: { id: input.seasonId, organizationId: input.organizationId },
      select: { programId: true },
    });
    programId = season?.programId ?? null;
  }

  if (input.eventId) {
    const event = await db.event.findFirst({
      where: { id: input.eventId, organizationId: input.organizationId },
      select: { programId: true, teamId: true },
    });
    if (!programId) {
      programId = event?.programId ?? null;
    }
    if (!teamId) {
      teamId = event?.teamId ?? null;
    }
  }

  if (input.noteId) {
    const note = await db.observationNote.findFirst({
      where: { id: input.noteId, organizationId: input.organizationId },
      select: {
        teamId: true,
        event: { select: { programId: true, teamId: true } },
      },
    });
    if (!teamId) {
      teamId = note?.teamId ?? note?.event?.teamId ?? null;
    }
    if (!programId) {
      programId = note?.event?.programId ?? null;
    }
  }

  if (input.taskId) {
    const task = await db.followUpTask.findFirst({
      where: { id: input.taskId, organizationId: input.organizationId },
      select: {
        sourceEvent: { select: { programId: true, teamId: true } },
        sourceNote: {
          select: {
            teamId: true,
            event: { select: { programId: true, teamId: true } },
          },
        },
      },
    });
    if (!teamId) {
      teamId =
        task?.sourceEvent?.teamId ?? task?.sourceNote?.teamId ?? task?.sourceNote?.event?.teamId ?? null;
    }
    if (!programId) {
      programId = task?.sourceEvent?.programId ?? task?.sourceNote?.event?.programId ?? null;
    }
  }

  if (input.roleAssignmentId) {
    const roleAssignment = await db.roleAssignment.findFirst({
      where: { id: input.roleAssignmentId, organizationId: input.organizationId },
      select: { programId: true, teamId: true },
    });
    if (!teamId) {
      teamId = roleAssignment?.teamId ?? null;
    }
    if (!programId) {
      programId = roleAssignment?.programId ?? null;
    }
  }

  if (teamId && !programId) {
    const team = await db.team.findFirst({
      where: { id: teamId, organizationId: input.organizationId },
      select: { programId: true },
    });
    programId = team?.programId ?? null;
  }

  return { programId, teamId };
}

function roleScopeMatches(
  assignment: {
    scopeType: ScopeType;
    programId: string | null;
    teamId: string | null;
  },
  scope: PermissionScope,
): boolean {
  if (assignment.scopeType === ScopeType.ORGANIZATION) {
    return true;
  }

  if (assignment.scopeType === ScopeType.PROGRAM) {
    return Boolean(scope.programId && assignment.programId && scope.programId === assignment.programId);
  }

  return Boolean(scope.teamId && assignment.teamId && scope.teamId === assignment.teamId);
}

async function resolvePermissionDecision(input: PermissionCheckInput): Promise<PermissionDecision> {
  if (!input.actorUserId) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
      message: "You must be signed in to continue.",
    };
  }

  const organization = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, status: true },
  });

  if (!organization) {
    return {
      allowed: false,
      reason: "ORGANIZATION_UNAVAILABLE",
      message: "No active organization context is available yet.",
    };
  }

  if (organization.status !== OrgStatus.ACTIVE) {
    return {
      allowed: false,
      reason: "ORGANIZATION_INACTIVE",
      message: "This organization is inactive and cannot accept write changes.",
    };
  }

  if (!isSupportedAction(input.action)) {
    return {
      allowed: false,
      reason: "UNSUPPORTED_ACTION",
      message: "This action is not enabled in the current MVP authorization policy.",
    };
  }
  const action: SupportedAction = input.action;

  const userAccount = await db.userAccount.findFirst({
    where: {
      organizationId: input.organizationId,
      clerkUserId: input.actorUserId,
    },
    select: {
      personId: true,
    },
  });

  if (!userAccount?.personId) {
    return {
      allowed: false,
      reason: "UNLINKED_ACCOUNT",
      message: "Your account is not linked to a CadreOS person yet. Link your person at /account/link-person.",
    };
  }

  const assignments = await db.roleAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      personId: userAccount.personId,
    },
    select: {
      roleType: true,
      scopeType: true,
      programId: true,
      teamId: true,
    },
  });

  if (assignments.length === 0) {
    return {
      allowed: false,
      reason: "INSUFFICIENT_ROLE",
      message: "You do not have a staff role assignment that allows this action.",
    };
  }

  const scope = await resolvePermissionScope(input);
  const requiresScope = SCOPED_ACTIONS.has(action);

  const hasOrganizationAdminOverride = assignments.some((assignment) => {
    if (assignment.roleType !== RoleType.ORGANIZATION_ADMIN || assignment.scopeType !== ScopeType.ORGANIZATION) {
      return false;
    }

    return STAFF_ACTIONS_BY_ROLE[assignment.roleType].has(action);
  });

  if (requiresScope && !scope.programId && !scope.teamId && !hasOrganizationAdminOverride) {
    return {
      allowed: false,
      reason: "INSUFFICIENT_ROLE",
      message:
        "This action requires scoped staff access, and no program/team scope could be resolved for the request.",
    };
  }

  const isAllowed = assignments.some((assignment) => {
    const roleActions = STAFF_ACTIONS_BY_ROLE[assignment.roleType];

    if (!roleActions.has(action)) {
      return false;
    }

    if (!requiresScope) {
      return assignment.scopeType === ScopeType.ORGANIZATION;
    }

    return roleScopeMatches(assignment, scope);
  });

  if (!isAllowed) {
    return {
      allowed: false,
      reason: "INSUFFICIENT_ROLE",
      message: "You do not have permission for this write action in the requested scope.",
    };
  }

  return {
    allowed: true,
    reason: "INSUFFICIENT_ROLE",
    message: "",
  };
}

export async function canPerformAction(input: PermissionCheckInput): Promise<boolean> {
  const decision = await resolvePermissionDecision(input);
  return decision.allowed;
}

export async function requirePermission(input: PermissionCheckInput): Promise<void> {
  const decision = await resolvePermissionDecision(input);

  if (!decision.allowed) {
    throw new PermissionDeniedError(decision.reason, decision.message);
  }
}
