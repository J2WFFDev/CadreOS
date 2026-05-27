/**
 * guardian-athlete-access.ts
 *
 * Arc 21C — Guardian / Household Readiness
 *
 * Provides guardian-perspective access control primitives for the
 * AthleteGuardianRelationship model.
 *
 * Design rules (canonical):
 * - Guardian access to athlete data is relationship-based, not role-global.
 * - A guardian may only access athletes they are explicitly linked to via
 *   AthleteGuardianRelationship within the same organization.
 * - Staff roles (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, ASSISTANT_COACH)
 *   use separate staff-scoped access helpers and are unaffected by this module.
 * - Household grouping is currently not a first-class model; pairwise
 *   AthleteGuardianRelationship rows are the canonical representation.
 * - Guardian-facing portal/self-service is deferred; these helpers establish
 *   the access-control foundation for future guardian-facing routes.
 */

import { db } from "@/lib/db";

// ── Types ────────────────────────────────────────────────────────────────────

export type GuardianAthleteLink = {
  athletePersonId: string;
  guardianPersonId: string;
};

export type AthleteGuardianReadinessState =
  | "no_guardian_on_file"
  | "guardian_account_link_missing"
  | "guardian_account_inactive_signal"
  | "guardian_ready";

export type GuardianAthleteAccessResult = {
  canAccess: boolean;
  reason:
    | "linked"
    | "not_linked"
    | "organization_mismatch"
    | "guardian_not_found"
    | "athlete_not_found";
};

// ── Pure predicates (no DB; fully testable) ───────────────────────────────────

/**
 * Given a pre-loaded list of AthleteGuardianRelationship-like links,
 * returns true if the specified guardian is linked to the specified athlete.
 *
 * Suitable for use in guards where relationships are already fetched.
 */
export function canGuardianSeeAthleteFromLinks(
  guardianPersonId: string,
  athletePersonId: string,
  links: GuardianAthleteLink[],
): boolean {
  return links.some(
    (link) =>
      link.guardianPersonId === guardianPersonId &&
      link.athletePersonId === athletePersonId,
  );
}

/**
 * Returns true if the athlete has at least one guardian linked.
 * Use on athlete-side links (athleteLinks from a Person query).
 */
export function hasAthleteGuardianCoverage(
  athleteLinks: Array<{ guardianPersonId: string }>,
): boolean {
  return athleteLinks.length > 0;
}

/**
 * Returns true if none of the athlete's guardian links have an active,
 * account-linked guardian. Used to flag operational readiness gaps.
 */
export function isMissingActiveGuardianCoverage(
  athleteLinks: Array<{
    guardian: {
      _count: { userAccounts: number };
      roles: Array<{ id: string }>;
    };
  }>,
): boolean {
  if (athleteLinks.length === 0) return true;

  return athleteLinks.every(
    (link) =>
      link.guardian._count.userAccounts === 0 ||
      link.guardian.roles.length === 0,
  );
}

/**
 * Derives the guardian readiness state for an athlete based on pre-loaded
 * relationship data. Returns the most specific gap state found.
 *
 * Priority: no_guardian_on_file > account_link_missing > inactive_signal > ready
 */
export function deriveAthleteGuardianReadinessState(
  athleteLinks: Array<{
    guardian: {
      _count: { userAccounts: number };
      roles: Array<{ id: string }>;
    };
  }>,
): AthleteGuardianReadinessState {
  if (athleteLinks.length === 0) {
    return "no_guardian_on_file";
  }

  const hasAccountLinkGap = athleteLinks.some(
    (link) => link.guardian._count.userAccounts === 0,
  );
  if (hasAccountLinkGap) {
    return "guardian_account_link_missing";
  }

  const hasInactiveAccountSignal = athleteLinks.some(
    (link) =>
      link.guardian._count.userAccounts > 0 && link.guardian.roles.length === 0,
  );
  if (hasInactiveAccountSignal) {
    return "guardian_account_inactive_signal";
  }

  return "guardian_ready";
}

/**
 * Returns a human-readable label for an AthleteGuardianReadinessState.
 */
export function formatAthleteGuardianReadinessLabel(
  state: AthleteGuardianReadinessState,
): string {
  switch (state) {
    case "no_guardian_on_file":
      return "No guardian on file";
    case "guardian_account_link_missing":
      return "Guardian account link missing";
    case "guardian_account_inactive_signal":
      return "Guardian account inactive signal";
    case "guardian_ready":
      return "Guardian-linked and ready";
  }
}

/**
 * Returns true if the readiness state indicates the guardian relationship
 * requires staff attention before guardian-dependent workflows can proceed.
 */
export function isGuardianReadinessActionRequired(
  state: AthleteGuardianReadinessState,
): boolean {
  return state !== "guardian_ready";
}

// ── DB-backed helpers ─────────────────────────────────────────────────────────

/**
 * Checks whether a guardian person is linked to a specific athlete within
 * the same organization. This is the canonical access control check for
 * future guardian-facing routes.
 *
 * Staff-role checks are out of scope here; use authorization/index.ts helpers
 * for staff-scoped decisions.
 */
export async function resolveGuardianAthleteAccess(input: {
  guardianPersonId: string;
  athletePersonId: string;
  organizationId: string;
}): Promise<GuardianAthleteAccessResult> {
  const relationship = await db.athleteGuardianRelationship.findFirst({
    where: {
      organizationId: input.organizationId,
      guardianPersonId: input.guardianPersonId,
      athletePersonId: input.athletePersonId,
    },
    select: { id: true },
  });

  if (relationship) {
    return { canAccess: true, reason: "linked" };
  }

  return { canAccess: false, reason: "not_linked" };
}

/**
 * Lists all athletes that a guardian is linked to within the organization.
 * Used by future guardian-facing routes to scope visible athlete data.
 */
export async function listAthletesForGuardian(input: {
  guardianPersonId: string;
  organizationId: string;
}): Promise<
  Array<{
    relationshipId: string;
    athletePersonId: string;
    relationshipType: string;
  }>
> {
  const links = await db.athleteGuardianRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      guardianPersonId: input.guardianPersonId,
    },
    orderBy: [
      { athlete: { lastName: "asc" } },
      { athlete: { firstName: "asc" } },
    ],
    select: {
      id: true,
      athletePersonId: true,
      relationshipType: true,
    },
  });

  return links.map((link) => ({
    relationshipId: link.id,
    athletePersonId: link.athletePersonId,
    relationshipType: link.relationshipType,
  }));
}

/**
 * Lists all guardians linked to an athlete within the organization.
 * Used by staff and future guardian-aware workflows.
 */
export async function listGuardiansForAthlete(input: {
  athletePersonId: string;
  organizationId: string;
}): Promise<
  Array<{
    relationshipId: string;
    guardianPersonId: string;
    relationshipType: string;
  }>
> {
  const links = await db.athleteGuardianRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      athletePersonId: input.athletePersonId,
    },
    orderBy: [
      { guardian: { lastName: "asc" } },
      { guardian: { firstName: "asc" } },
    ],
    select: {
      id: true,
      guardianPersonId: true,
      relationshipType: true,
    },
  });

  return links.map((link) => ({
    relationshipId: link.id,
    guardianPersonId: link.guardianPersonId,
    relationshipType: link.relationshipType,
  }));
}

/**
 * Returns true if the athlete has at least one guardian relationship on file
 * in the organization, without loading full relationship data.
 * Use for fast readiness gap detection in list queries.
 */
export async function athleteHasGuardianCoverage(input: {
  athletePersonId: string;
  organizationId: string;
}): Promise<boolean> {
  const count = await db.athleteGuardianRelationship.count({
    where: {
      organizationId: input.organizationId,
      athletePersonId: input.athletePersonId,
    },
  });

  return count > 0;
}
