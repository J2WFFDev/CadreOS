import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  bookingRequestWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";
import { resolveActorPersonId } from "@/lib/user-account";

function buildErrorRedirectUrl(requestUrl: string, input: {
  values: {
    facilityId: string;
    resourceId: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    programId: string;
    teamId: string;
    eventId: string;
  };
  fieldErrors?: Partial<
    Record<"facilityId" | "resourceId" | "title" | "description" | "startsAt" | "endsAt" | "programId" | "teamId" | "eventId", string>
  >;
  error?: string;
}) {
  const url = new URL("/field-ops/bookings/new", requestUrl);

  url.searchParams.set("facilityId", input.values.facilityId);
  url.searchParams.set("resourceId", input.values.resourceId);
  url.searchParams.set("title", input.values.title);
  url.searchParams.set("description", input.values.description);
  url.searchParams.set("startsAt", input.values.startsAt);
  url.searchParams.set("endsAt", input.values.endsAt);
  url.searchParams.set("programId", input.values.programId);
  url.searchParams.set("teamId", input.values.teamId);
  url.searchParams.set("eventId", input.values.eventId);

  if (input.fieldErrors?.facilityId) {
    url.searchParams.set("facilityIdError", input.fieldErrors.facilityId);
  }
  if (input.fieldErrors?.resourceId) {
    url.searchParams.set("resourceIdError", input.fieldErrors.resourceId);
  }
  if (input.fieldErrors?.title) {
    url.searchParams.set("titleError", input.fieldErrors.title);
  }
  if (input.fieldErrors?.description) {
    url.searchParams.set("descriptionError", input.fieldErrors.description);
  }
  if (input.fieldErrors?.startsAt) {
    url.searchParams.set("startsAtError", input.fieldErrors.startsAt);
  }
  if (input.fieldErrors?.endsAt) {
    url.searchParams.set("endsAtError", input.fieldErrors.endsAt);
  }
  if (input.fieldErrors?.programId) {
    url.searchParams.set("programIdError", input.fieldErrors.programId);
  }
  if (input.fieldErrors?.teamId) {
    url.searchParams.set("teamIdError", input.fieldErrors.teamId);
  }
  if (input.fieldErrors?.eventId) {
    url.searchParams.set("eventIdError", input.fieldErrors.eventId);
  }
  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    facilityId: getStringField(formData, "facilityId"),
    resourceId: getStringField(formData, "resourceId"),
    title: getStringField(formData, "title"),
    description: getStringField(formData, "description"),
    startsAt: getStringField(formData, "startsAt"),
    endsAt: getStringField(formData, "endsAt"),
    programId: getStringField(formData, "programId"),
    teamId: getStringField(formData, "teamId"),
    eventId: getStringField(formData, "eventId"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: scope.errorMessage ?? "Unable to create booking request right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = bookingRequestWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        fieldErrors: {
          facilityId: fieldErrors.facilityId?.[0],
          resourceId: fieldErrors.resourceId?.[0],
          title: fieldErrors.title?.[0],
          description: fieldErrors.description?.[0],
          startsAt: fieldErrors.startsAt?.[0],
          endsAt: fieldErrors.endsAt?.[0],
          programId: fieldErrors.programId?.[0],
          teamId: fieldErrors.teamId?.[0],
          eventId: fieldErrors.eventId?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "booking.create",
      programId: parsed.data.programId,
      teamId: parsed.data.teamId,
      eventId: parsed.data.eventId,
    });

    const resource = await db.facilityResource.findFirst({
      where: {
        id: parsed.data.resourceId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        facilityId: true,
      },
    });

    if (!resource) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          fieldErrors: {
            resourceId: "Select a valid resource in the active organization.",
          },
          error: "Resource selection is invalid.",
        }),
        303,
      );
    }

    if (parsed.data.facilityId && parsed.data.facilityId !== resource.facilityId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          fieldErrors: {
            facilityId: "Selected facility does not match the selected resource.",
          },
          error: "Facility/resource selection is inconsistent.",
        }),
        303,
      );
    }

    let resolvedProgramId = parsed.data.programId;
    let resolvedTeamId = parsed.data.teamId;

    if (resolvedProgramId) {
      const program = await db.program.findFirst({
        where: {
          id: resolvedProgramId,
          organizationId: scope.organizationId,
        },
        select: { id: true },
      });

      if (!program) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              programId: "Select a valid program in the active organization.",
            },
            error: "Program selection is invalid.",
          }),
          303,
        );
      }
    }

    if (resolvedTeamId) {
      const team = await db.team.findFirst({
        where: {
          id: resolvedTeamId,
          organizationId: scope.organizationId,
          ...(resolvedProgramId ? { programId: resolvedProgramId } : {}),
        },
        select: { id: true, programId: true },
      });

      if (!team) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              teamId: resolvedProgramId
                ? "Select a team that belongs to the selected program."
                : "Select a valid team in the active organization.",
            },
            error: "Team selection is invalid.",
          }),
          303,
        );
      }

      if (!resolvedProgramId) {
        resolvedProgramId = team.programId;
      }
    }

    if (parsed.data.eventId) {
      const event = await db.event.findFirst({
        where: {
          id: parsed.data.eventId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          programId: true,
          teamId: true,
        },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              eventId: "Select a valid event in the active organization.",
            },
            error: "Event selection is invalid.",
          }),
          303,
        );
      }

      if (resolvedProgramId && resolvedProgramId !== event.programId) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              eventId: "Selected event does not belong to the selected program.",
            },
            error: "Event selection is invalid for the selected program.",
          }),
          303,
        );
      }

      if (resolvedTeamId && event.teamId && resolvedTeamId !== event.teamId) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              eventId: "Selected event does not belong to the selected team.",
            },
            error: "Event selection is invalid for the selected team.",
          }),
          303,
        );
      }

      if (!resolvedProgramId) {
        resolvedProgramId = event.programId;
      }

      if (!resolvedTeamId) {
        resolvedTeamId = event.teamId;
      }
    }

    const requestedByPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!requestedByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "No organization person is available for booking requester attribution yet.",
        }),
        303,
      );
    }

    await db.resourceBooking.create({
      data: {
        organizationId: scope.organizationId,
        facilityId: resource.facilityId,
        resourceId: resource.id,
        title: parsed.data.title,
        description: parsed.data.description,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        programId: resolvedProgramId,
        teamId: resolvedTeamId,
        eventId: parsed.data.eventId,
        requestedByPersonId,
        status: parsed.data.status,
        precheckStatus: parsed.data.precheckStatus,
        approvalStatus: parsed.data.approvalStatus,
      },
      select: { id: true },
    });

    const redirectUrl = new URL("/field-ops/bookings", request.url);
    redirectUrl.searchParams.set("created", "1");
    redirectUrl.searchParams.set("resourceId", resource.id);

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "Booking references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating bookings."
            : "Unable to create booking request right now. Please try again.",
      }),
      303,
    );
  }
}
