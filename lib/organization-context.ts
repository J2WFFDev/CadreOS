import { Prisma } from "@prisma/client";

import { requireOrganizationContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertUserAccountForOrganization } from "@/lib/user-account";

type OrganizationAuthState = {
  clerkUserId: string | null;
  userAccountId: string | null;
  personId: string | null;
  organizationId: string | null;
  unresolvedPersonLink: boolean;
  usesFallbackOrganization: boolean;
};

export type OrganizationScope = {
  organizationId: string | null;
  organizationName: string | null;
  databaseReady: boolean;
  errorMessage: string | null;
  auth: OrganizationAuthState;
};

export async function getOrganizationScope(): Promise<OrganizationScope> {
  try {
    const authContext = await requireOrganizationContext();
    const baseAuthState: OrganizationAuthState = {
      clerkUserId: authContext.clerkUserId,
      userAccountId: authContext.userAccountId,
      personId: authContext.personId,
      organizationId: authContext.organizationId,
      unresolvedPersonLink: false,
      usesFallbackOrganization: false,
    };

    let usedFallbackOrganization = false;
    let selectedOrganization: { id: string; name: string } | null = null;

    if (authContext.organizationId) {
      selectedOrganization = await db.organization.findUnique({
        where: { id: authContext.organizationId },
        select: { id: true, name: true },
      });
    }

    if (!selectedOrganization) {
      // MVP fallback: no explicit Clerk org context is available, so resolve against the first
      // organization in the database ordered by creation date. This keeps the app functional
      // during single-org MVP operation. Remove once Clerk organization context is enforced.
      usedFallbackOrganization = true;
      selectedOrganization = await db.organization.findFirst({
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!selectedOrganization) {
      return {
        organizationId: null,
        organizationName: null,
        databaseReady: true,
        errorMessage: null,
        auth: {
          ...baseAuthState,
          organizationId: null,
          unresolvedPersonLink: false,
          usesFallbackOrganization: usedFallbackOrganization,
        },
      };
    }

    if (!authContext.clerkUserId) {
      return {
        organizationId: selectedOrganization.id,
        organizationName: selectedOrganization.name,
        databaseReady: true,
        errorMessage: null,
        auth: {
          ...baseAuthState,
          organizationId: selectedOrganization.id,
          unresolvedPersonLink: false,
          usesFallbackOrganization: usedFallbackOrganization,
        },
      };
    }

    const userAccount = await upsertUserAccountForOrganization({
      organizationId: selectedOrganization.id,
      clerkUserId: authContext.clerkUserId,
    });

    return {
      organizationId: selectedOrganization.id,
      organizationName: selectedOrganization.name,
      databaseReady: true,
      errorMessage: null,
      auth: {
        clerkUserId: authContext.clerkUserId,
        userAccountId: userAccount.id,
        personId: userAccount.personId,
        organizationId: userAccount.organizationId,
        unresolvedPersonLink: !userAccount.personId,
        usesFallbackOrganization: usedFallbackOrganization,
      },
    };
  } catch (error) {
    const isMissingSchemaError =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022");

    return {
      organizationId: null,
      organizationName: null,
      databaseReady: false,
      errorMessage: isMissingSchemaError
        ? "Database is reachable, but application tables are not available yet."
        : "Unable to query the database right now.",
      auth: {
        clerkUserId: null,
        userAccountId: null,
        personId: null,
        organizationId: null,
        unresolvedPersonLink: false,
        usesFallbackOrganization: false,
      },
    };
  }
}
