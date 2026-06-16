import { EntryListScope, EntryType, Prisma, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import { buildJournalEntryEditWhere, buildJournalEntryVisibilityWhere } from "@/lib/journals/access";

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

export type EntryOpsAccessReasonCode =
  | "ENTRY_NOT_FOUND"
  | "ENTRY_VISIBILITY_DENIED"
  | "ENTRY_ACTION_DENIED"
  | "ENTRY_ASSIGNMENT_MISSING"
  | "GUARDIAN_DEPENDENT_SCOPE_MISSING"
  | "ELEVATED_SCOPE_MISSING"
  | "ORG_ADMIN_OVERRIDE_APPLIED"
  | "ENTRY_OWNER_ACCESS"
  | "ENTRY_ASSIGNEE_ACCESS"
  | "ENTRY_ASSIGNMENT_ACCESS"
  | "GUARDIAN_DEPENDENT_SCOPE_APPLIED"
  | "ELEVATED_SCOPE_APPLIED";

export type EntryOpsAccessDecision = {
  allowed: boolean;
  reasonCode: EntryOpsAccessReasonCode;
};

export const ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE =
  "This work item could not be found or you do not have access to it.";

export function entryActionDeniedMessage(action: string): string {
  return `You can view this work item, but you do not have permission to ${action}.`;
}

export function resolveEntryOpsDetailAccessDecision(
  context: EntryOpsVisibilityContext,
  visibility: EntryOpsAllWorkDefaultVisibility,
  entry: EntryOpsEntryDetailSnapshot | null,
): EntryOpsAccessDecision {
  if (!entry) {
    return { allowed: false, reasonCode: "ENTRY_NOT_FOUND" };
  }

  if (!visibility.canRead) {
    return { allowed: false, reasonCode: "ENTRY_VISIBILITY_DENIED" };
  }

  if (visibility.organizationWide) {
    return { allowed: true, reasonCode: "ORG_ADMIN_OVERRIDE_APPLIED" };
  }

  if (!context.actorPersonId) {
    return { allowed: false, reasonCode: "ENTRY_VISIBILITY_DENIED" };
  }

  const actorPersonId = context.actorPersonId;
  if (entry.createdByPersonId === actorPersonId) {
    return { allowed: true, reasonCode: "ENTRY_OWNER_ACCESS" };
  }
  if (entry.assignedToPersonId === actorPersonId) {
    return { allowed: true, reasonCode: "ENTRY_ASSIGNEE_ACCESS" };
  }
  if (entry.assignments?.some((assignment) => assignment.personId === actorPersonId && assignment.revokedAt === null)) {
    return { allowed: true, reasonCode: "ENTRY_ASSIGNMENT_ACCESS" };
  }

  const dependentIds = context.linkedGuardianAthleteIds;
  if (
    (entry.createdByPersonId && dependentIds.has(entry.createdByPersonId)) ||
    (entry.assignedToPersonId && dependentIds.has(entry.assignedToPersonId)) ||
    entry.assignments?.some((assignment) => assignment.revokedAt === null && dependentIds.has(assignment.personId))
  ) {
    return { allowed: true, reasonCode: "GUARDIAN_DEPENDENT_SCOPE_APPLIED" };
  }

  if (
    (entry.teamId && visibility.teamIds.includes(entry.teamId)) ||
    (entry.team?.programId && visibility.programIds.includes(entry.team.programId))
  ) {
    return { allowed: true, reasonCode: "ELEVATED_SCOPE_APPLIED" };
  }

  if (context.assignments.some((assignment) => assignment.roleType === RoleType.PARENT_GUARDIAN)) {
    return { allowed: false, reasonCode: "GUARDIAN_DEPENDENT_SCOPE_MISSING" };
  }
  if (visibility.teamIds.length > 0 || visibility.programIds.length > 0) {
    return { allowed: false, reasonCode: "ELEVATED_SCOPE_MISSING" };
  }
  if (entry.assignments?.length) {
    return { allowed: false, reasonCode: "ENTRY_ASSIGNMENT_MISSING" };
  }

  return { allowed: false, reasonCode: "ENTRY_VISIBILITY_DENIED" };
}

export function logEntryOpsAccessDecision(input: {
  workflow: string;
  entryId: string;
  organizationId: string;
  actorPersonId: string | null;
  decision: EntryOpsAccessDecision;
}): void {
  const payload = {
    workflow: input.workflow,
    entryId: input.entryId,
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    allowed: input.decision.allowed,
    reasonCode: input.decision.reasonCode,
  };

  if (input.decision.allowed) {
    if (input.decision.reasonCode === "ORG_ADMIN_OVERRIDE_APPLIED") {
      console.info("[entryops.access]", payload);
    }
    return;
  }

  console.warn("[entryops.access]", payload);
}

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
      reason: "Organization admin default can view all Entries.",
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

  const isGuardian =
    context.linkedGuardianAthleteIds.size > 0 ||
    context.assignments.some((assignment) => assignment.roleType === RoleType.PARENT_GUARDIAN);
  if (isGuardian) {
    return {
      canRead: true,
      organizationWide: false,
      visiblePersonIds: unique([actorPersonId, ...context.linkedGuardianAthleteIds]),
      teamIds: [],
      programIds: [],
      reason: "Guardian default includes own work and related athletes.",
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
      {
        entryList: {
          scope: EntryListScope.PERSONAL,
          ownerPersonId: { in: visibility.visiblePersonIds },
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

export function buildEntryOpsTypeAwareVisibilityWhere(
  context: EntryOpsVisibilityContext,
  visibility: EntryOpsAllWorkDefaultVisibility,
): Prisma.EntryWhereInput {
  return {
    AND: [
      buildEntryOpsEntryDetailVisibilityWhere(visibility),
      {
        OR: [
          { type: { not: EntryType.JOURNAL } },
          buildJournalEntryVisibilityWhere(context),
        ],
      },
    ],
  };
}

export function buildJournalProtectedEntryVisibilityWhere(
  context: EntryOpsVisibilityContext,
  visibility: EntryOpsAllWorkDefaultVisibility,
): Prisma.EntryWhereInput {
  return {
    OR: [
      { type: { not: EntryType.JOURNAL } },
      {
        AND: [
          buildEntryOpsEntryDetailVisibilityWhere(visibility),
          buildJournalEntryVisibilityWhere(context),
        ],
      },
    ],
  };
}

export function buildEntryOpsActionVisibilityWhere(
  context: EntryOpsVisibilityContext,
  visibility: EntryOpsAllWorkDefaultVisibility,
): Prisma.EntryWhereInput {
  return {
    AND: [
      buildEntryOpsEntryDetailVisibilityWhere(visibility),
      {
        OR: [
          { type: { not: EntryType.JOURNAL } },
          buildJournalEntryEditWhere(context),
        ],
      },
    ],
  };
}

export async function resolveEntryOpsEntryActionVisibilityWhere(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<Prisma.EntryWhereInput> {
  const visibilityContext = await resolveEntryOpsVisibilityContext(input);
  const visibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  return buildEntryOpsActionVisibilityWhere(visibilityContext, visibility);
}

export async function resolveEntryOpsTypeAwareVisibilityWhere(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<Prisma.EntryWhereInput> {
  const visibilityContext = await resolveEntryOpsVisibilityContext(input);
  const visibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  return buildEntryOpsTypeAwareVisibilityWhere(visibilityContext, visibility);
}

export async function resolveJournalProtectedEntryVisibilityWhere(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<Prisma.EntryWhereInput> {
  const visibilityContext = await resolveEntryOpsVisibilityContext(input);
  const visibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);
  return buildJournalProtectedEntryVisibilityWhere(visibilityContext, visibility);
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
    linkedGuardianAthleteIds: new Set(guardianRelationships.map((relationship) => relationship.athletePersonId)),
  };
}
