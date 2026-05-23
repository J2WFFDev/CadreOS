import { Prisma } from "@prisma/client";

import { requireOrganizationContext } from "@/lib/auth";
import { db } from "@/lib/db";

export type OrganizationScope = {
  organizationId: string | null;
  organizationName: string | null;
  databaseReady: boolean;
  errorMessage: string | null;
};

export async function getOrganizationScope(): Promise<OrganizationScope> {
  try {
    const authContext = await requireOrganizationContext();

    if (authContext.organizationId) {
      const selectedOrganization = await db.organization.findUnique({
        where: { id: authContext.organizationId },
        select: { id: true, name: true },
      });

      if (selectedOrganization) {
        return {
          organizationId: selectedOrganization.id,
          organizationName: selectedOrganization.name,
          databaseReady: true,
          errorMessage: null,
        };
      }
    }

    const firstOrganization = await db.organization.findFirst({
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (!firstOrganization) {
      return {
        organizationId: null,
        organizationName: null,
        databaseReady: true,
        errorMessage: null,
      };
    }

    return {
      organizationId: firstOrganization.id,
      organizationName: firstOrganization.name,
      databaseReady: true,
      errorMessage: null,
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
    };
  }
}
