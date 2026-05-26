import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  memberMoveWorkflowSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(
  requestUrl: string,
  personId: string,
  input: {
    values: {
      sourceMembershipId: string;
      programId: string;
      teamId: string;
      seasonId: string;
      rosterRole: string;
    };
    fieldErrors?: Partial<Record<"sourceMembershipId" | "programId" | "teamId" | "seasonId" | "rosterRole", string>>;
    error?: string;
  },
) {
  const url = new URL(`/people/${personId}/move`, requestUrl);

  url.searchParams.set("sourceMembershipId", input.values.sourceMembershipId);
  url.searchParams.set("programId", input.values.programId);
  url.searchParams.set("teamId", input.values.teamId);
  url.searchParams.set("seasonId", input.values.seasonId);
  url.searchParams.set("rosterRole", input.values.rosterRole);

  if (input.fieldErrors?.sourceMembershipId) {
    url.searchParams.set("sourceMembershipIdError", input.fieldErrors.sourceMembershipId);
  }

  if (input.fieldErrors?.programId) {
    url.searchParams.set("programIdError", input.fieldErrors.programId);
  }

  if (input.fieldErrors?.teamId) {
    url.searchParams.set("teamIdError", input.fieldErrors.teamId);
  }

  if (input.fieldErrors?.seasonId) {
    url.searchParams.set("seasonIdError", input.fieldErrors.seasonId);
  }

  if (input.fieldErrors?.rosterRole) {
    url.searchParams.set("rosterRoleError", input.fieldErrors.rosterRole);
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    sourceMembershipId: getStringField(formData, "sourceMembershipId"),
    programId: getStringField(formData, "programId"),
    teamId: getStringField(formData, "teamId"),
    seasonId: getStringField(formData, "seasonId"),
    rosterRole: getStringField(formData, "rosterRole"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: scope.errorMessage ?? "Unable to move member right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = memberMoveWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        fieldErrors: {
          sourceMembershipId: fieldErrors.sourceMembershipId?.[0],
          programId: fieldErrors.programId?.[0],
          teamId: fieldErrors.teamId?.[0],
          seasonId: fieldErrors.seasonId?.[0],
          rosterRole: fieldErrors.rosterRole?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "person.move",
      programId: parsed.data.programId,
      teamId: parsed.data.teamId,
      seasonId: parsed.data.seasonId,
    });

    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!person) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "Person not found in the selected organization.",
        }),
        303,
      );
    }

    const program = await db.program.findFirst({
      where: {
        id: parsed.data.programId,
        organizationId: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!program) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          fieldErrors: {
            programId: "Select a valid program in the active organization.",
          },
          error: "Program selection is invalid.",
        }),
        303,
      );
    }

    const team = await db.team.findFirst({
      where: {
        id: parsed.data.teamId,
        organizationId: organizationId,
      },
      select: {
        id: true,
        programId: true,
      },
    });

    if (!team) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          fieldErrors: {
            teamId: "Select a valid team in the active organization.",
          },
          error: "Team selection is invalid.",
        }),
        303,
      );
    }

    if (team.programId !== program.id) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          fieldErrors: {
            teamId: "Selected team must belong to the selected program.",
          },
          error: "Team/program selection does not match.",
        }),
        303,
      );
    }

    const season = await db.season.findFirst({
      where: {
        id: parsed.data.seasonId,
        organizationId: organizationId,
      },
      select: {
        id: true,
        programId: true,
        name: true,
      },
    });

    if (!season) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          fieldErrors: {
            seasonId: "Select a valid season in the active organization.",
          },
          error: "Season selection is invalid.",
        }),
        303,
      );
    }

    if (season.programId !== program.id) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          fieldErrors: {
            seasonId: "Selected season must belong to the selected program.",
          },
          error: "Season/program selection does not match.",
        }),
        303,
      );
    }

    const sourceMembership = parsed.data.sourceMembershipId
      ? await db.rosterMembership.findFirst({
          where: {
            id: parsed.data.sourceMembershipId,
            organizationId: organizationId,
            personId: person.id,
          },
          select: {
            id: true,
            seasonId: true,
            teamId: true,
            rosterRole: true,
          },
        })
      : null;

    if (parsed.data.sourceMembershipId && !sourceMembership) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          fieldErrors: {
            sourceMembershipId: "Select a valid current membership for this person.",
          },
          error: "Current membership selection is invalid.",
        }),
        303,
      );
    }

    const existingTargetMembership = await db.rosterMembership.findFirst({
      where: {
        organizationId: organizationId,
        personId: person.id,
        teamId: team.id,
        seasonId: season.id,
      },
      select: {
        id: true,
      },
    });

    if (
      existingTargetMembership &&
      (!sourceMembership || existingTargetMembership.id !== sourceMembership.id)
    ) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "This person already has that team/season roster membership.",
        }),
        303,
      );
    }

    if (!sourceMembership || sourceMembership.seasonId !== season.id) {
      const sameProgramSeasonMembership = await db.rosterMembership.findFirst({
        where: {
          organizationId: organizationId,
          personId: person.id,
          seasonId: season.id,
          team: {
            programId: program.id,
          },
        },
        select: {
          id: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      });

      if (sameProgramSeasonMembership) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, personId, {
            values,
            fieldErrors: {
              sourceMembershipId:
                "Select the existing current-season membership to transition in place for this program.",
            },
            error: `This person already has a ${season.name} membership in this program (${sameProgramSeasonMembership.team.name}).`,
          }),
          303,
        );
      }
    }

    let successMessage = "Member moved to the new team/program context.";

    if (sourceMembership && sourceMembership.seasonId === season.id) {
      await db.rosterMembership.update({
        where: {
          id: sourceMembership.id,
          organizationId: organizationId,
        },
        data: {
          teamId: team.id,
          seasonId: season.id,
          rosterRole: parsed.data.rosterRole,
        },
      });
      successMessage = "Member transitioned on the selected season roster.";
    } else if (!existingTargetMembership) {
      await db.rosterMembership.create({
        data: {
          organizationId: organizationId,
          personId: person.id,
          teamId: team.id,
          seasonId: season.id,
          rosterRole: parsed.data.rosterRole,
        },
      });
      successMessage = "Member added to the selected team/program roster context.";
    } else {
      await db.rosterMembership.update({
        where: {
          id: existingTargetMembership.id,
          organizationId: organizationId,
        },
        data: {
          rosterRole: parsed.data.rosterRole,
        },
      });
      successMessage = "Membership updated for the selected team/program context.";
    }

    const successUrl = new URL(`/people/${person.id}`, request.url);
    successUrl.searchParams.set("moveSuccess", successMessage);

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "That roster membership already exists.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before moving members."
            : "Unable to move member right now. Please try again.",
      }),
      303,
    );
  }
}
