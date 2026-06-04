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

export type EntryOpsEntryDetailSnapshot = {
  createdByPersonId: string | null;
  assignedToPersonId: string | null;
  teamId: string | null;
  team?: { programId: string | null } | null;
  assignments?: Array<{ personId: string; revokedAt: Date | null }>;
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

export function buildEntryOpsEntryDetailVisibilityWhere(
  visibility: EntryOpsAllWorkDefaultVisibility,
): Prisma.EntryWhereInput {
  return buildEntryOpsAllWorkDefaultWhere(visibility);
}

export async function resolveEntryOpsEntryActionVisibilityWhere(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<Prisma.EntryWhereInput> {
  const visibilityContext = await resolveEntryOpsVisibilityContext(input);
  const visibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  return buildEntryOpsEntryDetailVisibilityWhere(visibility);
}

export async function countVisibleEntryOpsActionEntries(input: {
  organizationId: string;
  actorPersonId: string | null;
  entryIds: string[];
}): Promise<number> {
  const entryIds = unique(input.entryIds);
  if (entryIds.length === 0) {
    return 0;
  }

  const visibilityWhere = await resolveEntryOpsEntryActionVisibilityWhere({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
  });

  return db.entry.count({
    where: {
      organizationId: input.organizationId,
      id: { in: entryIds },
      deletedAt: null,
      AND: [visibilityWhere],
    },
  });
}

export function canReadEntryOpsEntryDetail(
  visibility: EntryOpsAllWorkDefaultVisibility,
  entry: EntryOpsEntryDetailSnapshot,
): boolean {
  if (!visibility.canRead) {
    return false;
  }

  if (visibility.organizationWide) {
    return true;
  }

  const visiblePersonIds = new Set(visibility.visiblePersonIds);
  if (entry.createdByPersonId && visiblePersonIds.has(entry.createdByPersonId)) {
    return true;
  }
  if (entry.assignedToPersonId && visiblePersonIds.has(entry.assignedToPersonId)) {
    return true;
  }
  if (entry.assignments?.some((assignment) => assignment.revokedAt === null && visiblePersonIds.has(assignment.personId))) {
    return true;
  }
  if (entry.teamId && visibility.teamIds.includes(entry.teamId)) {
    return true;
  }
  if (entry.team?.programId && visibility.programIds.includes(entry.team.programId)) {
    return true;
  }

  return false;
}

export function canSelfEditEntryOpsEntry(
  context: Pick<EntryOpsVisibilityContext, "actorPersonId">,
  entry: EntryOpsEntryDetailSnapshot,
): boolean {
  const actorPersonId = context.actorPersonId;
  if (!actorPersonId) {
    return false;
  }

  if (entry.createdByPersonId === actorPersonId) {
    return true;
  }

  if (entry.assignedToPersonId === actorPersonId) {
    return true;
  }

  return (
    entry.assignments?.some(
      (assignment) => assignment.personId === actorPersonId && assignment.revokedAt === null,
    ) ?? false
  );
}

export function canEditEntryOpsEntry(input: {
  canWriteEntries: boolean;
  context: Pick<EntryOpsVisibilityContext, "actorPersonId">;
  entry: EntryOpsEntryDetailSnapshot;
}): boolean {
  return input.canWriteEntries || canSelfEditEntryOpsEntry(input.context, input.entry);
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
