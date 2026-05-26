/**
 * Arc 19A — Unified Operational Entry Architecture
 *
 * Entry-specific authorization helpers.
 * Resolves read and write access for operational entries within the
 * organization-scoped permission model.
 */

import { RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

// ── Types ───────────────────────────────────────────────────────────────────

export type EntryAccessLevel = "NONE" | "READ" | "WRITE" | "MANAGE";

export type EntryAccessContext = {
  organizationId: string;
  actorPersonId: string | null;
};

type EntryAuthResult = {
  level: EntryAccessLevel;
  reason: string;
};

// ── Role-to-access mappings ─────────────────────────────────────────────────

/** Staff roles that may create and update entries. */
const ENTRY_WRITE_ROLES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
]);

/** Roles allowed to read entry runtime data. */
const ENTRY_READ_ROLES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
]);

/** Roles that may delete or manage entry lifecycle (soft-delete, restore). */
const ENTRY_MANAGE_ROLES = new Set<RoleType>([RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR]);

// ── Access resolution ───────────────────────────────────────────────────────

/**
 * Resolves the access level for an actor in the context of operational entries.
 *
 * Access levels:
 * - MANAGE — may create, update, delete, and manage all entries in the org.
 * - WRITE  — may create and update entries (staff-scoped).
 * - READ   — may read entries (all authenticated staff).
 * - NONE   — no access (unauthenticated or no staff role).
 */
export async function resolveEntryAccess(context: EntryAccessContext): Promise<EntryAuthResult> {
  if (!context.actorPersonId) {
    return { level: "NONE", reason: "No authenticated actor available." };
  }

  const assignments = await db.roleAssignment.findMany({
    where: {
      organizationId: context.organizationId,
      personId: context.actorPersonId,
    },
    select: { roleType: true, scopeType: true },
  });

  if (assignments.length === 0) {
    return { level: "NONE", reason: "Actor has no role assignments in this organization." };
  }

  const hasManageRole = assignments.some(
    (a) => ENTRY_MANAGE_ROLES.has(a.roleType) && a.scopeType === ScopeType.ORGANIZATION,
  );

  if (hasManageRole) {
    return { level: "MANAGE", reason: "Actor has organization-scoped admin or director role." };
  }

  const hasWriteRole = assignments.some((a) => ENTRY_WRITE_ROLES.has(a.roleType));

  if (hasWriteRole) {
    return { level: "WRITE", reason: "Actor has a staff role that permits entry write operations." };
  }

  const hasReadRole = assignments.some((a) => ENTRY_READ_ROLES.has(a.roleType));
  if (hasReadRole) {
    return { level: "READ", reason: "Actor has a staff role that permits entry read operations." };
  }

  return { level: "NONE", reason: "Actor has no staff role for entry access." };
}

/**
 * Returns true if the resolved access level meets the required level.
 * Levels ordered: NONE < READ < WRITE < MANAGE.
 */
export function meetsAccessLevel(actual: EntryAccessLevel, required: EntryAccessLevel): boolean {
  const ORDER: Record<EntryAccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, MANAGE: 3 };
  return ORDER[actual] >= ORDER[required];
}

/**
 * Resolves whether the actor may write (create/update) entries.
 */
export async function canWriteEntries(context: EntryAccessContext): Promise<boolean> {
  const result = await resolveEntryAccess(context);
  return meetsAccessLevel(result.level, "WRITE");
}

/**
 * Resolves whether the actor may manage (delete/restore) entries.
 */
export async function canManageEntries(context: EntryAccessContext): Promise<boolean> {
  const result = await resolveEntryAccess(context);
  return meetsAccessLevel(result.level, "MANAGE");
}
