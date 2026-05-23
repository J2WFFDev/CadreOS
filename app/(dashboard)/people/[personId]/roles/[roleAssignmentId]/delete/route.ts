import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/phase1c/workflows";

function buildErrorRedirectUrl(requestUrl: string, personId: string, error: string) {
  const url = new URL(`/people/${personId}`, requestUrl);
  url.searchParams.set("roleError", error);
  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string; roleAssignmentId: string }> },
) {
  const { personId, roleAssignmentId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        personId,
        scope.errorMessage ?? "Unable to remove role right now.",
      ),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "No organization context is available yet."),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "roleAssignment.delete",
    });

    const deleted = await db.roleAssignment.deleteMany({
      where: {
        id: roleAssignmentId,
        personId,
        organizationId: scope.organizationId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(
          request.url,
          personId,
          "Role assignment not found in the selected organization.",
        ),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/people/${personId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        personId,
        isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before removing roles."
          : "Unable to remove role right now. Please try again.",
      ),
      303,
    );
  }
}
