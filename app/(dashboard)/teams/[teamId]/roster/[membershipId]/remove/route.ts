import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, teamId: string, seasonId: string, error: string) {
  const url = new URL(`/teams/${teamId}`, requestUrl);

  if (seasonId) {
    url.searchParams.set("seasonId", seasonId);
  }

  url.searchParams.set("rosterError", error);

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; membershipId: string }> },
) {
  const { teamId, membershipId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const seasonId = getStringField(formData, "seasonId");

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        teamId,
        seasonId,
        scope.errorMessage ?? "Unable to remove roster member right now.",
      ),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, seasonId, "No organization context is available yet."),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "rosterMembership.delete",
      teamId,
    });

    const deleted = await db.rosterMembership.deleteMany({
      where: {
        id: membershipId,
        teamId,
        organizationId: scope.organizationId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(
          request.url,
          teamId,
          seasonId,
          "Roster membership not found in the selected organization.",
        ),
        303,
      );
    }

    const successUrl = new URL(`/teams/${teamId}`, request.url);

    if (seasonId) {
      successUrl.searchParams.set("seasonId", seasonId);
    }

    successUrl.searchParams.set("rosterSuccess", "Member removed from roster.");

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        teamId,
        seasonId,
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before removing roster members."
            : "Unable to remove roster member right now. Please try again.",
      ),
      303,
    );
  }
}
