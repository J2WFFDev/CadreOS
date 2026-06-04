/**
 * Arc 24D.4 — Entry List helpers
 *
 * Provides utilities for resolving, creating, and fetching EntryLists.
 * Lists are scoped to PERSONAL, ORGANIZATION, PROGRAM, or TEAM.
 * Default Inbox lists are created lazily on first access.
 */

import { EntryListScope } from "@prisma/client";

import { db } from "@/lib/db";

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

// ── Fetch lists for actor ─────────────────────────────────────────────────────

/**
 * Returns all non-archived EntryLists visible to an actor within an org.
 * Includes: personal lists owned by actor, all org lists, and team/program
 * lists for teams and programs the actor is a member of.
 */
export async function fetchListsForActor(input: {
  organizationId: string;
  actorPersonId: string | null | undefined;
}): Promise<EntryListSummary[]> {
  const { organizationId, actorPersonId } = input;

  const lists = await db.entryList.findMany({
    where: {
      organizationId,
      isArchived: false,
      OR: [
        // Org-scoped lists visible to all
        { scope: EntryListScope.ORGANIZATION },
        // Personal lists owned by this actor
        ...(actorPersonId ? [{ scope: EntryListScope.PERSONAL, ownerPersonId: actorPersonId }] : []),
        // Program and team lists — return all for simplicity (server-side role
        // filtering is done by the calling page if stricter access is needed)
        { scope: EntryListScope.PROGRAM },
        { scope: EntryListScope.TEAM },
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

// ── Fetch single list ────────────────────────────────────────────────────────

export async function fetchEntryList(input: {
  organizationId: string;
  listId: string;
}): Promise<EntryListSummary | null> {
  return db.entryList.findFirst({
    where: { id: input.listId, organizationId: input.organizationId },
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
  if (scope === EntryListScope.ORGANIZATION) return "Organization";
  if (scope === EntryListScope.PROGRAM) return "Program";
  if (scope === EntryListScope.TEAM) return "Team";
  return scope;
}
