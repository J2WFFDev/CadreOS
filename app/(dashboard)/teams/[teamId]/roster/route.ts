import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  rosterMembershipWorkflowSchema,
  selectSeededOrCurrentSeason,
} from "@/lib/phase1c/workflows";

function buildErrorRedirectUrl(requestUrl: string, teamId: string, input: {
  values: { personId: string; rosterRole: string };
  fieldErrors?: Partial<Record<"personId" | "rosterRole", string>>;
  error?: string;
}) {
  const url = new URL(`/teams/${teamId}`, requestUrl);

  url.searchParams.set("rosterPersonId", input.values.personId);
  url.searchParams.set("rosterRole", input.values.rosterRole);

  if (input.fieldErrors?.personId) {
    url.searchParams.set("rosterPersonIdError", input.fieldErrors.personId);
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
    rosterRole: getStringField(formData, "rosterRole"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: scope.errorMessage ?? "Unable to add roster member right now.",
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

  const parsed = rosterMembershipWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        fieldErrors: {
          personId: fieldErrors.personId?.[0],
          rosterRole: fieldErrors.rosterRole?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "rosterMembership.create",
    });

    const team = await db.team.findFirst({
      where: {
        id: teamId,
        organizationId: scope.organizationId,
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
        organizationId: scope.organizationId,
        programId: team.programId,
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    const selectedSeason = selectSeededOrCurrentSeason(seasons);

    if (!selectedSeason) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: "No seeded/current season is available for this team's program.",
        }),
        303,
      );
    }

    const person = await db.person.findFirst({
      where: {
        id: parsed.data.personId,
        organizationId: scope.organizationId,
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

    const existingMembership = await db.rosterMembership.findUnique({
      where: {
        teamId_seasonId_personId: {
          teamId: team.id,
          seasonId: selectedSeason.id,
          personId: person.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingMembership) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: `That person is already on this team's ${selectedSeason.name} roster.`,
        }),
        303,
      );
    }

    await db.rosterMembership.create({
      data: {
        organizationId: scope.organizationId,
        teamId: team.id,
        seasonId: selectedSeason.id,
        personId: person.id,
        rosterRole: parsed.data.rosterRole,
      },
    });

    return NextResponse.redirect(new URL(`/teams/${teamId}`, request.url), 303);
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
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before adding roster members."
          : "Unable to add roster member right now. Please try again.",
      }),
      303,
    );
  }
}
