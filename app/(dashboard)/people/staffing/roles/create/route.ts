import { Prisma, StaffingRoleCategory } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, params: Record<string, string>) {
  const url = new URL("/people/staffing", requestUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, {
        error: scope.errorMessage ?? "Unable to create staffing role right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "No organization context is available yet." }),
      303,
    );
  }

  const name = getStringField(formData, "name").trim();
  const description = getStringField(formData, "description").trim();
  const categoryRaw = getStringField(formData, "category").trim().toUpperCase();

  if (!name) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "Role name is required." }),
      303,
    );
  }

  if (!Object.values(StaffingRoleCategory).includes(categoryRaw as StaffingRoleCategory)) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "Role category is invalid." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "roleAssignment.create",
    });

    await db.staffingRole.create({
      data: {
        organizationId: scope.organizationId,
        name,
        category: categoryRaw as StaffingRoleCategory,
        description: description || null,
        active: true,
        isSystemDefined: false,
      },
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, {
        success: `Created staffing role ${name}.`,
      }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "A staffing role with that name already exists."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating staffing roles."
            : "Unable to create staffing role right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: message }),
      303,
    );
  }
}
