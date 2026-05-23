import { Prisma } from "@prisma/client";

import { isClerkConfigured, requireOrganizationContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertUserAccountForOrganization } from "@/lib/user-account";

type OrganizationAuthState = {
  clerkUserId: string | null;
  userAccountId: string | null;
  personId: string | null;
  organizationId: string | null;
  unresolvedPersonLink: boolean;
  usesFallbackOrganization: boolean;
  organizationWarning: string | null;
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
    const clerkConfigured = isClerkConfigured();
    const baseAuthState: OrganizationAuthState = {
      clerkUserId: authContext.clerkUserId,
      userAccountId: authContext.userAccountId,
      personId: authContext.personId,
      organizationId: authContext.organizationId,
      unresolvedPersonLink: false,
      usesFallbackOrganization: false,
      organizationWarning: null,
    };

    let usedFallbackOrganization = false;
    let organizationWarning: string | null = null;
    let selectedOrganization: { id: string; name: string } | null = null;

    if (authContext.organizationId) {
      selectedOrganization = await db.organization.findUnique({
        where: { id: authContext.organizationId },
        select: { id: true, name: true },
      });
    }

    if (!selectedOrganization && authContext.clerkUserId && clerkConfigured) {
      const fallbackCandidates = await db.organization.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
        take: 2,
      });

      if (fallbackCandidates.length === 1) {
        usedFallbackOrganization = true;
        selectedOrganization = fallbackCandidates[0] ?? null;
        organizationWarning =
          "Active organization is using a temporary single-organization fallback because Clerk organization context is unavailable.";
      } else if (fallbackCandidates.length > 1) {
        return {
          organizationId: null,
          organizationName: null,
          databaseReady: true,
          errorMessage:
            "Unable to resolve an active organization safely. Multiple organizations exist and no explicit Clerk organization context is available.",
          auth: {
            ...baseAuthState,
            organizationId: null,
            unresolvedPersonLink: false,
            usesFallbackOrganization: false,
            organizationWarning:
              "Organization fallback is disabled for multi-organization environments without explicit Clerk organization context.",
          },
        };
      }
    }

    if (!selectedOrganization && !authContext.clerkUserId) {
      usedFallbackOrganization = true;
      selectedOrganization = await db.organization.findFirst({
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      });
      organizationWarning =
        "Running without Clerk configuration. Using first-organization fallback for local development only.";
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
          organizationWarning,
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
          organizationWarning,
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
        organizationWarning,
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
        organizationWarning: null,
      },
    };
  }
}
