/**
 * Arc 24D.4 — Entry List helpers
 *
 * Provides utilities for resolving, creating, and fetching EntryLists.
 * Lists are scoped to PERSONAL, ORGANIZATION, PROGRAM, or TEAM.
 * Default Inbox lists are created lazily on first access.
 */

import { EntryListScope, Prisma, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import { resolveGuardianDerivedScope } from "@/lib/guardian-derived-scope";

// ── Types ────────────────────────────────────────────────────────────────────

export type EntryListSummary = {
  id: string;
  name: string;
  scope: EntryListScope;
  isInbox: boolean;
  isArchived: boolean;
  ownerPersonId: string | null;
  programId: string | null;
  teamId: string | null;
};

type EntryListRoleScope = {
  roleType: RoleType;
  scopeType: ScopeType;
  programId: string | null;
  teamId: string | null;
};

export type EntryListVisibility = {
  canRead: boolean;
  canCreatePersonalList: boolean;
  canManageSharedLists: boolean;
  organizationWide: boolean;
  programIds: string[];
  teamIds: string[];
  where: Prisma.EntryListWhereInput;
};

export type EntryListHierarchyProgram = {
  id: string;
  name: string;
  lists: EntryListSummary[];
  teams: Array<{
    id: string;
    name: string;
    lists: EntryListSummary[];
  }>;
};

export type EntryListHierarchy = {
  personalLists: EntryListSummary[];
  adminSharedLists: EntryListSummary[];
  programs: EntryListHierarchyProgram[];
};

export type ResolveDefaultListInput =
  | { scope: "PERSONAL"; organizationId: string; ownerPersonId: string }
  | { scope: "ORGANIZATION"; organizationId: string }
  | { scope: "TEAM"; organizationId: string; teamId: string }
  | { scope: "PROGRAM"; organizationId: string; programId: string };

export type ResolveEntryDefaultInboxInput = {
  organizationId: string;
  actorPersonId?: string | null;
  teamId?: string | null;
};

// ── Default Inbox names ───────────────────────────────────────────────────────

const INBOX_NAMES: Record<EntryListScope, string> = {
  PERSONAL: "Inbox",
  ORGANIZATION: "Org Inbox",
  PROGRAM: "Program Inbox",
  TEAM: "Team Inbox",
};

export const DEFAULT_PERSONAL_LIST_NAMES = ["Inbox", "Outbox", "Knowledge", "Practice", "Skills"] as const;
export const DEFAULT_ADMIN_SHARED_LIST_NAMES = ["FieldOps", "GearOps", "ResourceOps"] as const;

const DEFAULT_PERSONAL_LIST_ORDER = new Map<string, number>(
  DEFAULT_PERSONAL_LIST_NAMES.map((name, index) => [name, index]),
);

export function sortPersonalEntryLists(lists: EntryListSummary[]): EntryListSummary[] {
  return [...lists].sort((a, b) => {
    const aRank = a.isInbox ? 0 : (DEFAULT_PERSONAL_LIST_ORDER.get(a.name) ?? Number.MAX_SAFE_INTEGER);
    const bRank = b.isInbox ? 0 : (DEFAULT_PERSONAL_LIST_ORDER.get(b.name) ?? Number.MAX_SAFE_INTEGER);
    return aRank - bRank || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function ensureDefaultPersonalLists(input: {
  organizationId: string;
  ownerPersonId: string;
}): Promise<void> {
  await resolveOrCreateDefaultList({
    scope: "PERSONAL",
    organizationId: input.organizationId,
    ownerPersonId: input.ownerPersonId,
  });

  const existing = await db.entryList.findMany({
    where: {
      organizationId: input.organizationId,
      scope: EntryListScope.PERSONAL,
      ownerPersonId: input.ownerPersonId,
      name: { in: DEFAULT_PERSONAL_LIST_NAMES.slice(1) },
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((list) => list.name));

  for (const name of DEFAULT_PERSONAL_LIST_NAMES.slice(1)) {
    if (!existingNames.has(name)) {
      await db.entryList.create({
        data: {
          organizationId: input.organizationId,
          ownerPersonId: input.ownerPersonId,
          scope: EntryListScope.PERSONAL,
          name,
          isInbox: false,
        },
        select: { id: true },
      });
    }
  }
}

export async function ensureDefaultAdminSharedLists(input: { organizationId: string }): Promise<void> {
  const existing = await db.entryList.findMany({
    where: {
      organizationId: input.organizationId,
      scope: EntryListScope.ORGANIZATION,
      name: { in: [...DEFAULT_ADMIN_SHARED_LIST_NAMES] },
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((list) => list.name));

  for (const name of DEFAULT_ADMIN_SHARED_LIST_NAMES) {
    if (!existingNames.has(name)) {
      await db.entryList.create({
        data: {
          organizationId: input.organizationId,
          scope: EntryListScope.ORGANIZATION,
          name,
          isInbox: false,
        },
        select: { id: true },
      });
    }
  }
}

// ── Find-or-create default inbox ──────────────────────────────────────────────

/**
 * Returns the default Inbox list for the given scope, creating it if it does
 * not yet exist. Idempotent and safe to call on every quick capture.
 */
export async function resolveOrCreateDefaultList(input: ResolveDefaultListInput): Promise<{ id: string }> {
  const { scope, organizationId } = input;
  const name = INBOX_NAMES[scope];

  if (scope === "PERSONAL") {
    const { ownerPersonId } = input as { scope: "PERSONAL"; organizationId: string; ownerPersonId: string };
    const existing = await db.entryList.findFirst({
      where: { organizationId, scope: EntryListScope.PERSONAL, ownerPersonId, isInbox: true },
      select: { id: true },
    });
    if (existing) return existing;
    return db.entryList.create({
      data: { organizationId, name, scope: EntryListScope.PERSONAL, isInbox: true, ownerPersonId },
      select: { id: true },
    });
  }

  if (scope === "ORGANIZATION") {
    const existing = await db.entryList.findFirst({
      where: { organizationId, scope: EntryListScope.ORGANIZATION, isInbox: true },
      select: { id: true },
    });
    if (existing) return existing;
    return db.entryList.create({
      data: { organizationId, name, scope: EntryListScope.ORGANIZATION, isInbox: true },
      select: { id: true },
    });
  }

  if (scope === "PROGRAM") {
    const { programId } = input as { scope: "PROGRAM"; organizationId: string; programId: string };
    const existing = await db.entryList.findFirst({
      where: { organizationId, scope: EntryListScope.PROGRAM, programId, isInbox: true },
      select: { id: true },
    });
    if (existing) return existing;
    return db.entryList.create({
      data: { organizationId, name, scope: EntryListScope.PROGRAM, isInbox: true, programId },
      select: { id: true },
    });
  }

  // TEAM
  const { teamId } = input as { scope: "TEAM"; organizationId: string; teamId: string };
  const existing = await db.entryList.findFirst({
    where: { organizationId, scope: EntryListScope.TEAM, teamId, isInbox: true },
    select: { id: true },
  });
  if (existing) return existing;
  return db.entryList.create({
    data: { organizationId, name, scope: EntryListScope.TEAM, isInbox: true, teamId },
    select: { id: true },
  });
}

export function buildDefaultInboxListResolutionInput(input: ResolveEntryDefaultInboxInput): ResolveDefaultListInput {
  if (input.teamId) {
    return { scope: "TEAM", organizationId: input.organizationId, teamId: input.teamId };
  }

  if (input.actorPersonId) {
    return { scope: "PERSONAL", organizationId: input.organizationId, ownerPersonId: input.actorPersonId };
  }

  return { scope: "ORGANIZATION", organizationId: input.organizationId };
}

export async function resolveOrCreateEntryDefaultInboxList(input: ResolveEntryDefaultInboxInput): Promise<{ id: string }> {
  return resolveOrCreateDefaultList(buildDefaultInboxListResolutionInput(input));
}

function canManageSharedEntryLists(assignments: EntryListRoleScope[]): boolean {
  return assignments.some(
    (assignment) =>
      assignment.roleType === RoleType.ORGANIZATION_ADMIN &&
      assignment.scopeType === ScopeType.ORGANIZATION,
  );
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function buildEntryListVisibilityForActor(input: {
  organizationId: string;
  actorPersonId: string | null | undefined;
  assignments: EntryListRoleScope[];
  derivedProgramIds?: string[];
  derivedTeamIds?: string[];
}): EntryListVisibility {
  const { organizationId, actorPersonId, assignments } = input;

  if (!actorPersonId) {
    return {
      canRead: false,
      canCreatePersonalList: false,
      canManageSharedLists: false,
      organizationWide: false,
      programIds: [],
      teamIds: [],
      where: { id: "__entry_list_no_actor__" },
    };
  }

  const canManageSharedLists = canManageSharedEntryLists(assignments);
  const programIds = unique([
    ...assignments
      .filter((assignment) => assignment.scopeType === ScopeType.PROGRAM)
      .map((assignment) => assignment.programId),
    ...(input.derivedProgramIds ?? []),
  ]);
  const teamIds = unique([
    ...assignments
      .filter((assignment) => assignment.scopeType === ScopeType.TEAM)
      .map((assignment) => assignment.teamId),
    ...(input.derivedTeamIds ?? []),
  ]);

  if (canManageSharedLists) {
    return {
      canRead: true,
      canCreatePersonalList: true,
      canManageSharedLists: true,
      organizationWide: true,
      programIds: [],
      teamIds: [],
      where: {
        organizationId,
        OR: [
          { scope: EntryListScope.PERSONAL, ownerPersonId: actorPersonId },
          { scope: { not: EntryListScope.PERSONAL } },
        ],
      },
    };
  }

  const visibleScopes: Prisma.EntryListWhereInput[] = [
    {
      scope: EntryListScope.PERSONAL,
      ownerPersonId: actorPersonId,
    },
  ];
  if (programIds.length > 0) {
    visibleScopes.push(
      { scope: EntryListScope.PROGRAM, programId: { in: programIds } },
      { scope: EntryListScope.TEAM, team: { programId: { in: programIds } } },
    );
  }
  if (teamIds.length > 0) {
    visibleScopes.push({ scope: EntryListScope.TEAM, teamId: { in: teamIds } });
  }

  return {
    canRead: true,
    canCreatePersonalList: true,
    canManageSharedLists: false,
    organizationWide: false,
    programIds,
    teamIds,
    where: {
      organizationId,
      OR: visibleScopes,
    },
  };
}

export async function resolveEntryListVisibility(input: {
  organizationId: string;
  actorPersonId: string | null | undefined;
}): Promise<EntryListVisibility> {
  const { organizationId, actorPersonId } = input;
  if (!actorPersonId) return buildEntryListVisibilityForActor({ organizationId, actorPersonId, assignments: [] });

  const [assignments, guardianScope] = await Promise.all([
    db.roleAssignment.findMany({
      where: { organizationId, personId: actorPersonId },
      select: { roleType: true, scopeType: true, programId: true, teamId: true },
    }),
    resolveGuardianDerivedScope({
      organizationId,
      guardianPersonId: actorPersonId,
    }),
  ]);
  return buildEntryListVisibilityForActor({
    organizationId,
    actorPersonId,
    assignments,
    derivedProgramIds: guardianScope.derivedProgramIds,
    derivedTeamIds: guardianScope.derivedTeamIds,
  });
}

// ── Fetch lists for actor ─────────────────────────────────────────────────────

/**
 * Returns EntryLists visible to an actor within an org. Archived containers
 * are opt-in so assignment pickers continue to show active lists only.
 * Container visibility never grants visibility to its Entries.
 */
export async function fetchListsForActor(input: {
  organizationId: string;
  actorPersonId: string | null | undefined;
  includeArchived?: boolean;
}): Promise<EntryListSummary[]> {
  const visibility = await resolveEntryListVisibility(input);

  if (!visibility.canRead) {
    return [];
  }

  const lists = await db.entryList.findMany({
    where: {
      AND: [
        visibility.where,
        ...(input.includeArchived ? [] : [{ isArchived: false }]),
      ],
    },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      scope: true,
      isInbox: true,
      isArchived: true,
      ownerPersonId: true,
      programId: true,
      teamId: true,
    },
  });

  return lists;
}

export function buildEntryListHierarchy(input: {
  visibility: EntryListVisibility;
  lists: EntryListSummary[];
  programs: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; programId: string }>;
}): EntryListHierarchy {
  const { visibility } = input;
  const compareNames = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const visibleTeams = input.teams
    .filter(
      (team) =>
        visibility.organizationWide ||
        visibility.teamIds.includes(team.id) ||
        visibility.programIds.includes(team.programId),
    )
    .sort(compareNames);
  const visibleProgramIds = new Set([
    ...visibility.programIds,
    ...visibleTeams.map((team) => team.programId),
  ]);

  const programs = input.programs
    .filter((program) => visibility.organizationWide || visibleProgramIds.has(program.id))
    .sort(compareNames)
    .map((program) => ({
      id: program.id,
      name: program.name,
      lists: input.lists
        .filter((list) => list.scope === EntryListScope.PROGRAM && list.programId === program.id)
        .sort(compareNames),
      teams: visibleTeams
        .filter((team) => team.programId === program.id)
        .map((team) => ({
          id: team.id,
          name: team.name,
          lists: input.lists
            .filter((list) => list.scope === EntryListScope.TEAM && list.teamId === team.id)
            .sort(compareNames),
        })),
    }));

  return {
    personalLists: sortPersonalEntryLists(input.lists.filter((list) => list.scope === EntryListScope.PERSONAL)),
    adminSharedLists: visibility.organizationWide
      ? input.lists.filter((list) => list.scope === EntryListScope.ORGANIZATION).sort(compareNames)
      : [],
    programs,
  };
}

// ── Fetch single list ────────────────────────────────────────────────────────

export async function fetchEntryList(input: {
  organizationId: string;
  listId: string;
  actorPersonId?: string | null;
}): Promise<EntryListSummary | null> {
  const visibility =
    "actorPersonId" in input
      ? await resolveEntryListVisibility({
          organizationId: input.organizationId,
          actorPersonId: input.actorPersonId,
        })
      : null;

  if (visibility && !visibility.canRead) {
    return null;
  }

  return db.entryList.findFirst({
    where: {
      id: input.listId,
      organizationId: input.organizationId,
      ...(visibility ? { AND: [visibility.where] } : {}),
    },
    select: {
      id: true,
      name: true,
      scope: true,
      isInbox: true,
      isArchived: true,
      ownerPersonId: true,
      programId: true,
      teamId: true,
    },
  });
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export function labelForEntryListScope(scope: EntryListScope): string {
  if (scope === EntryListScope.PERSONAL) return "Personal";
  if (scope === EntryListScope.ORGANIZATION) return "Shared";
  if (scope === EntryListScope.PROGRAM) return "Program";
  if (scope === EntryListScope.TEAM) return "Team";
  return scope;
}
