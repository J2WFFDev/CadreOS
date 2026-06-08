import { EntryStatus, EntryType, EntryVisibility, Prisma, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

type RoleAssignmentScope = {
  roleType: RoleType;
  scopeType: ScopeType;
  teamId: string | null;
  programId: string | null;
};

export type JournalAccessContext = {
  actorPersonId: string | null;
  assignments: RoleAssignmentScope[];
  linkedGuardianAthleteIds: Set<string>;
};

export type JournalAccessEntry = {
  id: string;
  type: EntryType;
  createdByPersonId: string;
  status: EntryStatus;
  visibility: EntryVisibility;
  teamId: string | null;
  teamProgramId?: string | null;
};

const ADMIN_ROLE_TYPES = new Set<RoleType>([RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR]);
const COACH_ROLE_TYPES = new Set<RoleType>([RoleType.COACH, RoleType.ASSISTANT_COACH]);

export async function resolveJournalAccessContext(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<JournalAccessContext> {
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

  const isGuardian = assignments.some((assignment) => assignment.roleType === RoleType.PARENT_GUARDIAN);
  const guardianRelationships = isGuardian
    ? await db.athleteGuardianRelationship.findMany({
        where: {
          organizationId: input.organizationId,
          guardianPersonId: input.actorPersonId,
        },
        select: {
          athletePersonId: true,
        },
      })
    : [];

  return {
    actorPersonId: input.actorPersonId,
    assignments,
    linkedGuardianAthleteIds: new Set(guardianRelationships.map((relationship) => relationship.athletePersonId)),
  };
}

function hasScopedAssignment(
  assignments: RoleAssignmentScope[],
  roleTypes: Set<RoleType>,
  input: { teamId: string | null; teamProgramId?: string | null },
): boolean {
  return assignments.some((assignment) => {
    if (!roleTypes.has(assignment.roleType)) return false;

    if (assignment.scopeType === ScopeType.ORGANIZATION) {
      return true;
    }

    if (assignment.scopeType === ScopeType.TEAM) {
      return Boolean(input.teamId && assignment.teamId && input.teamId === assignment.teamId);
    }

    if (assignment.scopeType === ScopeType.PROGRAM) {
      return Boolean(input.teamProgramId && assignment.programId && input.teamProgramId === assignment.programId);
    }

    return false;
  });
}

export function hasJournalAdminAccess(context: JournalAccessContext): boolean {
  return hasScopedAssignment(context.assignments, ADMIN_ROLE_TYPES, { teamId: null, teamProgramId: null });
}

export function canCreateJournal(context: JournalAccessContext): boolean {
  if (!context.actorPersonId) return false;

  if (hasJournalAdminAccess(context)) return true;

  return context.assignments.some((assignment) => assignment.roleType === RoleType.ATHLETE);
}

export function canReadJournalEntry(context: JournalAccessContext, entry: JournalAccessEntry): boolean {
  if (!context.actorPersonId || entry.type !== EntryType.JOURNAL) return false;

  if (entry.createdByPersonId === context.actorPersonId) return true;
  if (hasJournalAdminAccess(context)) return true;

  const isSubmitted = entry.status === EntryStatus.DONE;
  if (!isSubmitted) {
    return false;
  }

  if (entry.visibility === EntryVisibility.TEAM_STAFF) {
    return hasScopedAssignment(context.assignments, COACH_ROLE_TYPES, {
      teamId: entry.teamId,
      teamProgramId: entry.teamProgramId,
    });
  }

  if (entry.visibility === EntryVisibility.ORGANIZATION_SCOPED) {
    return context.linkedGuardianAthleteIds.has(entry.createdByPersonId);
  }

  return false;
}

export function buildJournalEntryVisibilityWhere(context: JournalAccessContext): Prisma.EntryWhereInput {
  if (!context.actorPersonId) {
    return { id: "__journals_no_visible_entries__" };
  }

  if (hasJournalAdminAccess(context)) {
    return { type: EntryType.JOURNAL };
  }

  const submittedVisibility: Prisma.EntryWhereInput[] = [];
  const coachAssignments = context.assignments.filter((assignment) => COACH_ROLE_TYPES.has(assignment.roleType));
  const hasOrganizationCoachScope = coachAssignments.some(
    (assignment) => assignment.scopeType === ScopeType.ORGANIZATION,
  );
  const coachTeamIds = Array.from(
    new Set(
      coachAssignments
        .filter((assignment) => assignment.scopeType === ScopeType.TEAM)
        .map((assignment) => assignment.teamId)
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  );
  const coachProgramIds = Array.from(
    new Set(
      coachAssignments
        .filter((assignment) => assignment.scopeType === ScopeType.PROGRAM)
        .map((assignment) => assignment.programId)
        .filter((programId): programId is string => Boolean(programId)),
    ),
  );

  if (hasOrganizationCoachScope || coachTeamIds.length > 0 || coachProgramIds.length > 0) {
    const scopeWhere: Prisma.EntryWhereInput =
      hasOrganizationCoachScope
        ? {}
        : {
            OR: [
              ...(coachTeamIds.length > 0 ? [{ teamId: { in: coachTeamIds } }] : []),
              ...(coachProgramIds.length > 0 ? [{ team: { programId: { in: coachProgramIds } } }] : []),
            ],
          };
    submittedVisibility.push({
      status: EntryStatus.DONE,
      visibility: EntryVisibility.TEAM_STAFF,
      ...scopeWhere,
    });
  }

  if (context.linkedGuardianAthleteIds.size > 0) {
    submittedVisibility.push({
      status: EntryStatus.DONE,
      visibility: EntryVisibility.ORGANIZATION_SCOPED,
      createdByPersonId: { in: Array.from(context.linkedGuardianAthleteIds) },
    });
  }

  return {
    type: EntryType.JOURNAL,
    OR: [
      { createdByPersonId: context.actorPersonId },
      ...submittedVisibility,
    ],
  };
}

export function buildJournalEntryEditWhere(context: JournalAccessContext): Prisma.EntryWhereInput {
  if (!context.actorPersonId) {
    return { id: "__journals_no_editable_entries__" };
  }

  return {
    type: EntryType.JOURNAL,
    status: EntryStatus.OPEN,
    createdByPersonId: context.actorPersonId,
  };
}

export function canEditJournalDraft(context: JournalAccessContext, entry: JournalAccessEntry): boolean {
  return Boolean(
    context.actorPersonId &&
      entry.type === EntryType.JOURNAL &&
      entry.createdByPersonId === context.actorPersonId &&
      entry.status === EntryStatus.OPEN,
  );
}

export function canSubmitJournal(context: JournalAccessContext, entry: JournalAccessEntry): boolean {
  return canEditJournalDraft(context, entry);
}

export function canArchiveJournal(context: JournalAccessContext, entry: JournalAccessEntry): boolean {
  if (!context.actorPersonId || entry.type !== EntryType.JOURNAL) return false;
  if (entry.createdByPersonId === context.actorPersonId) return true;
  return hasJournalAdminAccess(context);
}

export function canRestoreJournal(context: JournalAccessContext, entry: JournalAccessEntry): boolean {
  return canArchiveJournal(context, entry);
}
