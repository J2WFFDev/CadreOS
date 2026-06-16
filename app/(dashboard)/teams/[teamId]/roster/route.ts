import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { findRosterMembershipDuplicate } from "@/lib/member-ops-duplicate-guardrails";
import { isRosterRoleType } from "@/lib/member-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  rosterMembershipWorkflowSchema,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, teamId: string, input: {
  values: { personId: string; seasonId: string; rosterRole: string };
  fieldErrors?: Partial<Record<"personId" | "seasonId" | "rosterRole", string>>;
  error?: string;
}) {
  const url = new URL(`/teams/${teamId}`, requestUrl);

  url.searchParams.set("rosterPersonId", input.values.personId);
  url.searchParams.set("seasonId", input.values.seasonId);
  url.searchParams.set("rosterRole", input.values.rosterRole);

  if (input.fieldErrors?.personId) {
    url.searchParams.set("rosterPersonIdError", input.fieldErrors.personId);
  }

  if (input.fieldErrors?.seasonId) {
    url.searchParams.set("seasonIdError", input.fieldErrors.seasonId);
  }

  if (input.fieldErrors?.rosterRole) {
    url.searchParams.set("rosterRoleError", input.fieldErrors.rosterRole);
  }

  if (input.error) {
    url.searchParams.set("rosterError", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    personId: getStringField(formData, "personId"),
    seasonId: getStringField(formData, "seasonId"),
    rosterRole: getStringField(formData, "rosterRole"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: scope.errorMessage ?? "Unable to add roster membership right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = rosterMembershipWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        fieldErrors: {
          personId: fieldErrors.personId?.[0],
          seasonId: fieldErrors.seasonId?.[0],
          rosterRole: fieldErrors.rosterRole?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  if (!isRosterRoleType(parsed.data.rosterRole)) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        fieldErrors: {
          rosterRole: "Select a valid roster role for this membership.",
        },
        error: "Roster role selection is invalid.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "rosterMembership.create",
      teamId,
    });

    const team = await db.team.findFirst({
      where: {
        id: teamId,
        organizationId: organizationId,
      },
      select: {
        id: true,
        programId: true,
      },
    });

    if (!team) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: "Team not found in the selected organization.",
        }),
        303,
      );
    }

    const seasons = await db.season.findMany({
      where: {
        organizationId: organizationId,
        programId: team.programId,
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    const selectedSeason = seasons.find((season) => season.id === parsed.data.seasonId) ?? null;

    if (!selectedSeason) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          fieldErrors: {
            seasonId: "Select a valid season for this team's program.",
          },
          error: "Season selection is invalid.",
        }),
        303,
      );
    }

    const person = await db.person.findFirst({
      where: {
        id: parsed.data.personId,
        organizationId: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!person) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          fieldErrors: {
            personId: "Select a valid person in the active organization.",
          },
          error: "Person selection is invalid.",
        }),
        303,
      );
    }

    const existingMemberships = await db.rosterMembership.findMany({
      where: {
        organizationId,
        personId: person.id,
        seasonId: selectedSeason.id,
      },
      select: {
        id: true,
        personId: true,
        teamId: true,
        seasonId: true,
        rosterRole: true,
        team: {
          select: {
            name: true,
            programId: true,
          },
        },
      },
    });
    const duplicateMembership = findRosterMembershipDuplicate({
      existingMemberships,
      target: {
        personId: person.id,
        teamId: team.id,
        seasonId: selectedSeason.id,
        rosterRole: parsed.data.rosterRole,
        programId: team.programId,
        seasonName: selectedSeason.name,
      },
    });

    if (duplicateMembership.duplicate) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: duplicateMembership.message,
        }),
        303,
      );
    }

    await db.rosterMembership.create({
      data: {
        organizationId: organizationId,
        teamId: team.id,
        seasonId: selectedSeason.id,
        personId: person.id,
        rosterRole: parsed.data.rosterRole,
      },
    });

    const successUrl = new URL(`/teams/${teamId}`, request.url);
    successUrl.searchParams.set("seasonId", selectedSeason.id);
    successUrl.searchParams.set("rosterSuccess", "Roster membership added.");

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: "That roster membership already exists.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before adding roster memberships."
            : "Unable to add roster membership right now. Please try again.",
      }),
      303,
    );
  }
}
