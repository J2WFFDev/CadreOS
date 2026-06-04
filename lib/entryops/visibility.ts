import { Prisma, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

export type EntryOpsRoleAssignmentScope = {
  roleType: RoleType;
  scopeType: ScopeType;
  teamId: string | null;
  programId: string | null;
};

export type EntryOpsVisibilityContext = {
  actorPersonId: string | null;
  assignments: EntryOpsRoleAssignmentScope[];
  linkedGuardianAthleteIds: Set<string>;
};

export type EntryOpsAllWorkDefaultVisibility = {
  canRead: boolean;
  organizationWide: boolean;
  visiblePersonIds: string[];
  teamIds: string[];
  programIds: string[];
  reason: string;
};

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function resolveEntryOpsAllWorkDefaultVisibility(
  context: EntryOpsVisibilityContext,
): EntryOpsAllWorkDefaultVisibility {
  const actorPersonId = context.actorPersonId;

  if (!actorPersonId) {
    return {
      canRead: false,
      organizationWide: false,
      visiblePersonIds: [],
      teamIds: [],
      programIds: [],
      reason: "No authenticated CadreOS person is available.",
    };
  }

  const hasOrgAdmin = context.assignments.some(
    (assignment) =>
      assignment.roleType === RoleType.ORGANIZATION_ADMIN &&
      assignment.scopeType === ScopeType.ORGANIZATION,
  );

  if (hasOrgAdmin) {
    return {
      canRead: true,
      organizationWide: true,
      visiblePersonIds: [],
      teamIds: [],
      programIds: [],
      reason: "Organization admin default can view all work items.",
    };
  }

  const programManagerAssignments = context.assignments.filter(
    (assignment) => assignment.roleType === RoleType.PROGRAM_DIRECTOR,
  );
  const programIds = unique(programManagerAssignments.map((assignment) => assignment.programId));
  const teamIds = unique(programManagerAssignments.map((assignment) => assignment.teamId));

  if (programIds.length > 0 || teamIds.length > 0) {
    return {
      canRead: true,
      organizationWide: false,
      visiblePersonIds: [actorPersonId],
      teamIds,
      programIds,
      reason: "Program manager default is scoped to available program/team assignments plus own work.",
    };
  }

  const isGuardian = context.assignments.some((assignment) => assignment.roleType === RoleType.PARENT_GUARDIAN);
  if (isGuardian) {
    return {
      canRead: true,
      organizationWide: false,
      visiblePersonIds: unique([actorPersonId, ...context.linkedGuardianAthleteIds]),
      teamIds: [],
      programIds: [],
      reason: "Guardian default includes own work and linked dependent athletes.",
    };
  }

  return {
    canRead: true,
    organizationWide: false,
    visiblePersonIds: [actorPersonId],
    teamIds: [],
    programIds: [],
    reason: "Default EntryOps view is limited to the actor's own work.",
  };
}

export function buildEntryOpsAllWorkDefaultWhere(
  visibility: EntryOpsAllWorkDefaultVisibility,
): Prisma.EntryWhereInput {
  if (!visibility.canRead) {
    return { id: "__entryops_no_visible_entries__" };
  }

  if (visibility.organizationWide) {
    return {};
  }

  const or: Prisma.EntryWhereInput[] = [];

  if (visibility.visiblePersonIds.length > 0) {
    or.push(
      { createdByPersonId: { in: visibility.visiblePersonIds } },
      { assignedToPersonId: { in: visibility.visiblePersonIds } },
      {
        assignments: {
          some: {
            personId: { in: visibility.visiblePersonIds },
            revokedAt: null,
          },
        },
      },
    );
  }

  if (visibility.teamIds.length > 0) {
    or.push({ teamId: { in: visibility.teamIds } });
  }

  if (visibility.programIds.length > 0) {
    or.push({ team: { programId: { in: visibility.programIds } } });
  }

  return or.length > 0 ? { OR: or } : { id: "__entryops_no_visible_entries__" };
}

export async function resolveEntryOpsVisibilityContext(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<EntryOpsVisibilityContext> {
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
        select: { athletePersonId: true },
      })
    : [];

  return {
    actorPersonId: input.actorPersonId,
    assignments,
    linkedGuardianAthleteIds: new Set(guardianRelationships.map((relationship) => relationship.athletePersonId)),
  };
}
