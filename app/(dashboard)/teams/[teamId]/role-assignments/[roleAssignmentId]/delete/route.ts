import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, teamId: string, error: string) {
  const url = new URL(`/teams/${teamId}`, requestUrl);
  url.searchParams.set("teamRoleError", error);
  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; roleAssignmentId: string }> },
) {
  const { teamId, roleAssignmentId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        teamId,
        scope.errorMessage ?? "Unable to remove role right now.",
      ),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, "No organization context is available yet."),
      303,
    );
  }
  const organizationId = scope.organizationId;

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "roleAssignment.delete",
      roleAssignmentId,
    });

    const deleted = await db.roleAssignment.deleteMany({
      where: {
        id: roleAssignmentId,
        teamId,
        organizationId: organizationId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(
          request.url,
          teamId,
          "Role assignment not found in the selected organization.",
        ),
        303,
      );
    }

    const successUrl = new URL(`/teams/${teamId}`, request.url);
    successUrl.searchParams.set("roleSuccess", "Role assignment removed.");

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        teamId,
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before removing roles."
            : "Unable to remove role right now. Please try again.",
      ),
      303,
    );
  }
}
