import { Prisma, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import type { OrganizationScope } from "@/lib/organization-context";

export type BootstrapAdminEligibilityReason =
  | "ELIGIBLE"
  | "DATABASE_UNAVAILABLE"
  | "NOT_SIGNED_IN"
  | "ORGANIZATION_UNAVAILABLE"
  | "USER_ACCOUNT_UNAVAILABLE"
  | "ACCOUNT_UNLINKED"
  | "LINKED_PERSON_NOT_IN_ORGANIZATION"
  | "ADMIN_EXISTS";

export type BootstrapAdminEligibility = {
  isEligible: boolean;
  reason: BootstrapAdminEligibilityReason;
  organizationId: string | null;
  personId: string | null;
  organizationAdminCount: number | null;
};

export async function getBootstrapOrganizationAdminEligibility(
  scope: OrganizationScope,
): Promise<BootstrapAdminEligibility> {
  if (!scope.databaseReady) {
    return {
      isEligible: false,
      reason: "DATABASE_UNAVAILABLE",
      organizationId: null,
      personId: null,
      organizationAdminCount: null,
    };
  }

  if (!scope.auth.clerkUserId) {
    return {
      isEligible: false,
      reason: "NOT_SIGNED_IN",
      organizationId: null,
      personId: null,
      organizationAdminCount: null,
    };
  }

  if (!scope.organizationId) {
    return {
      isEligible: false,
      reason: "ORGANIZATION_UNAVAILABLE",
      organizationId: null,
      personId: null,
      organizationAdminCount: null,
    };
  }

  if (!scope.auth.userAccountId) {
    return {
      isEligible: false,
      reason: "USER_ACCOUNT_UNAVAILABLE",
      organizationId: scope.organizationId,
      personId: null,
      organizationAdminCount: null,
    };
  }

  if (!scope.auth.personId) {
    return {
      isEligible: false,
      reason: "ACCOUNT_UNLINKED",
      organizationId: scope.organizationId,
      personId: null,
      organizationAdminCount: null,
    };
  }

  const [organizationAdminCount, linkedPerson] = await Promise.all([
    db.roleAssignment.count({
      where: {
        organizationId: scope.organizationId,
        roleType: RoleType.ORGANIZATION_ADMIN,
        scopeType: ScopeType.ORGANIZATION,
      },
    }),
    db.person.findFirst({
      where: {
        id: scope.auth.personId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!linkedPerson) {
    return {
      isEligible: false,
      reason: "LINKED_PERSON_NOT_IN_ORGANIZATION",
      organizationId: scope.organizationId,
      personId: scope.auth.personId,
      organizationAdminCount,
    };
  }

  if (organizationAdminCount > 0) {
    return {
      isEligible: false,
      reason: "ADMIN_EXISTS",
      organizationId: scope.organizationId,
      personId: linkedPerson.id,
      organizationAdminCount,
    };
  }

  return {
    isEligible: true,
    reason: "ELIGIBLE",
    organizationId: scope.organizationId,
    personId: linkedPerson.id,
    organizationAdminCount,
  };
}

export type CreateBootstrapOrganizationAdminResult =
  | { status: "CREATED" }
  | { status: "ADMIN_EXISTS" }
  | { status: "PERSON_NOT_IN_ORGANIZATION" }
  | { status: "ALREADY_ASSIGNED" }
  | { status: "CONFLICT_RETRY" };

export async function createBootstrapOrganizationAdmin(input: {
  organizationId: string;
  personId: string;
}): Promise<CreateBootstrapOrganizationAdminResult> {
  try {
    const result = await db.$transaction(
      async (transaction) => {
        const person = await transaction.person.findFirst({
          where: {
            id: input.personId,
            organizationId: input.organizationId,
          },
          select: {
            id: true,
          },
        });

        if (!person) {
          return { status: "PERSON_NOT_IN_ORGANIZATION" } as const;
        }

        const organizationAdminCount = await transaction.roleAssignment.count({
          where: {
            organizationId: input.organizationId,
            roleType: RoleType.ORGANIZATION_ADMIN,
            scopeType: ScopeType.ORGANIZATION,
          },
        });

        if (organizationAdminCount > 0) {
          return { status: "ADMIN_EXISTS" } as const;
        }

        const existingAssignment = await transaction.roleAssignment.findFirst({
          where: {
            organizationId: input.organizationId,
            personId: input.personId,
            roleType: RoleType.ORGANIZATION_ADMIN,
            scopeType: ScopeType.ORGANIZATION,
            programId: null,
            teamId: null,
          },
          select: {
            id: true,
          },
        });

        if (existingAssignment) {
          return { status: "ALREADY_ASSIGNED" } as const;
        }

        await transaction.roleAssignment.create({
          data: {
            organizationId: input.organizationId,
            personId: input.personId,
            roleType: RoleType.ORGANIZATION_ADMIN,
            scopeType: ScopeType.ORGANIZATION,
            programId: null,
            teamId: null,
          },
        });

        return { status: "CREATED" } as const;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "ALREADY_ASSIGNED" };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { status: "CONFLICT_RETRY" };
    }

    throw error;
  }
}
