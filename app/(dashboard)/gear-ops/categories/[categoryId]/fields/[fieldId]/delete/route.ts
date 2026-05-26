import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, categoryId: string, key?: string, value?: string) {
  const url = new URL(`/gear-ops/categories/${categoryId}`, requestUrl);
  if (key && value) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ categoryId: string; fieldId: string }> },
) {
  const { categoryId, fieldId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, categoryId, "fieldError", scope.errorMessage ?? "Unable to remove the custom field right now."),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, categoryId, "fieldError", "No organization context is available yet."),
      303,
    );
  }
  const organizationId = scope.organizationId;

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearCategoryField.delete",
    });

    const deleted = await db.gearCategoryField.deleteMany({
      where: {
        id: fieldId,
        categoryId,
        organizationId: organizationId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, categoryId, "fieldError", "Custom field not found in this organization."),
        303,
      );
    }

    return NextResponse.redirect(buildRedirectUrl(request.url, categoryId, "fieldDeleted", "1"), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        categoryId,
        "fieldError",
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before removing category fields."
            : "Unable to remove the custom field right now. Please try again.",
      ),
      303,
    );
  }
}
