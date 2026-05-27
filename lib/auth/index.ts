import { auth } from "@clerk/nextjs/server";
import { RoleType } from "@prisma/client";

import { db } from "@/lib/db";

export type AuthContext = {
  userId: string | null;
  clerkUserId: string | null;
  userAccountId: string | null;
  personId: string | null;
  organizationId: string | null;
};

/**
 * Full CadreOS user context resolved from a Clerk session.
 * Returned by getCurrentCadreUser().
 */
export type CadreUserContext = {
  clerkUserId: string;
  userAccountId: string;
  personId: string | null;
  organizationId: string;
  /** True when personId is set and the account is fully linked to a Person record. */
  isLinked: boolean;
};

/**
 * Supported CadreOS module identifiers for canAccessModule().
 */
export type CadreModule = "Roster" | "Entry" | "Journal" | "GearOps" | "FieldOps" | "ResourceOps";

/**
 * Module access rules (current MVP policy).
 * Extracted as a constant to avoid repeated allocation on each canAccessModule() call.
 */
const MODULE_ALLOWED_ROLES: Record<CadreModule, RoleType[]> = {
  Roster: [RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR, RoleType.COACH, RoleType.ASSISTANT_COACH],
  Entry: [RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR, RoleType.COACH, RoleType.ASSISTANT_COACH],
  Journal: [RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR, RoleType.COACH, RoleType.ASSISTANT_COACH],
  GearOps: [RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR, RoleType.COACH],
  FieldOps: [RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR, RoleType.COACH],
  ResourceOps: [RoleType.ORGANIZATION_ADMIN, RoleType.PROGRAM_DIRECTOR],
};

const LOCAL_UNCONFIGURED_AUTH_CONTEXT: AuthContext = {
  userId: null,
  clerkUserId: null,
  userAccountId: null,
  personId: null,
  organizationId: null,
};

export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

/**
 * Returns true when ENABLE_TEST_PERSONAS=true is set in non-production environments.
 * Always returns false in production.
 */
export function isTestPersonasEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ENABLE_TEST_PERSONAS === "true";
}

/**
 * Returns true when ENABLE_ROLE_DEBUG=true is set in non-production environments.
 * Always returns false in production.
 */
export function isRoleDebugEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ENABLE_ROLE_DEBUG === "true";
}

async function getClerkAuthContext(): Promise<AuthContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("Unauthenticated request.");
  }

  return {
    userId,
    clerkUserId: userId,
    userAccountId: null,
    personId: null,
    organizationId: orgId ?? null,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  if (isClerkConfigured()) {
    return getClerkAuthContext();
  }

  // Local/dev fallback when Clerk env vars are missing. This is fail-safe:
  // no user and no org are assumed so writes remain denied and org selection cannot be spoofed.
  return LOCAL_UNCONFIGURED_AUTH_CONTEXT;
}

export async function requireOrganizationContext(): Promise<AuthContext> {
  return requireAuthContext();
}

/**
 * Resolves the full CadreOS user context for the current Clerk session.
 *
 * Looks up the UserAccount row by clerkUserId and returns it together with
 * the linked personId (if set). Throws if the session is unauthenticated or
 * if no UserAccount exists for the resolved clerkUserId + organizationId pair.
 *
 * Emits a [role-debug] log line when ENABLE_ROLE_DEBUG=true.
 */
export async function getCurrentCadreUser(organizationId: string): Promise<CadreUserContext> {
  const authContext = await requireAuthContext();

  if (!authContext.clerkUserId) {
    throw new Error("Unauthenticated: no Clerk session.");
  }

  const userAccount = await db.userAccount.findFirst({
    where: {
      clerkUserId: authContext.clerkUserId,
      organizationId,
    },
    select: {
      id: true,
      personId: true,
      organizationId: true,
    },
  });

  if (!userAccount) {
    throw new Error(
      "No UserAccount found for this session and organization. Visit /account to set up your account.",
    );
  }

  const context: CadreUserContext = {
    clerkUserId: authContext.clerkUserId,
    userAccountId: userAccount.id,
    personId: userAccount.personId,
    organizationId: userAccount.organizationId,
    isLinked: Boolean(userAccount.personId),
  };

  if (isRoleDebugEnabled()) {
    console.log("[role-debug] getCurrentCadreUser", {
      clerkUserId: context.clerkUserId,
      userAccountId: context.userAccountId,
      personId: context.personId,
      organizationId: context.organizationId,
      isLinked: context.isLinked,
    });
  }

  return context;
}

/**
 * Resolves the current CadreOS user context and throws a descriptive error
 * if the account is not yet linked to a Person record.
 *
 * Use this in route handlers that require a fully provisioned staff member.
 */
export async function requireMembership(organizationId: string): Promise<CadreUserContext> {
  const context = await getCurrentCadreUser(organizationId);

  if (!context.isLinked) {
    throw new Error(
      "Your account is not linked to a CadreOS person yet. Link your person at /account/link-person.",
    );
  }

  return context;
}

/**
 * Returns true if the actor holds any staff role assignment that grants access to
 * the requested module within the given organization.
 *
 * Module access rules are defined in MODULE_ALLOWED_ROLES.
 *
 * Returns false when actorPersonId is null (unlinked account).
 */
export async function canAccessModule(input: {
  organizationId: string;
  actorPersonId: string | null;
  module: CadreModule;
}): Promise<boolean> {
  if (!input.actorPersonId) return false;

  const allowedRoles = MODULE_ALLOWED_ROLES[input.module];

  const assignment = await db.roleAssignment.findFirst({
    where: {
      organizationId: input.organizationId,
      personId: input.actorPersonId,
      roleType: { in: allowedRoles },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}
