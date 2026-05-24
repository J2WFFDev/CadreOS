import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  attendanceWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  selectSeededOrCurrentSeason,
} from "@/lib/workflows";
import { resolveActorPersonId } from "@/lib/user-account";

function buildErrorRedirectUrl(requestUrl: string, eventId: string, input: {
  values: { personId: string; status: string; reasonCode: string; attendanceView: string; continueCapture: string };
  fieldErrors?: Partial<Record<"personId" | "status" | "reasonCode", string>>;
  error?: string;
}) {
  const url = new URL(`/events/${eventId}`, requestUrl);

  url.searchParams.set("attendancePersonId", input.values.personId);
  url.searchParams.set("attendanceStatus", input.values.status);
  url.searchParams.set("attendanceReasonCode", input.values.reasonCode);
  url.searchParams.set("attendanceView", input.values.attendanceView);
  if (input.values.continueCapture === "1") {
    url.searchParams.set("attendanceContinue", "1");
  }

  if (input.fieldErrors?.personId) {
    url.searchParams.set("attendancePersonIdError", input.fieldErrors.personId);
  }

  if (input.fieldErrors?.status) {
    url.searchParams.set("attendanceStatusError", input.fieldErrors.status);
  }

  if (input.fieldErrors?.reasonCode) {
    url.searchParams.set("attendanceReasonCodeError", input.fieldErrors.reasonCode);
  }

  if (input.error) {
    url.searchParams.set("attendanceError", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    personId: getStringField(formData, "personId"),
    status: getStringField(formData, "status"),
    reasonCode: getStringField(formData, "reasonCode"),
    attendanceView: getStringField(formData, "attendanceView"),
    continueCapture: getStringField(formData, "continueCapture"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        error: scope.errorMessage ?? "Unable to save attendance right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = attendanceWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        fieldErrors: {
          personId: fieldErrors.personId?.[0],
          status: fieldErrors.status?.[0],
          reasonCode: fieldErrors.reasonCode?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "attendance.upsert",
      eventId,
    });

    const event = await db.event.findFirst({
      where: {
        id: eventId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        teamId: true,
        programId: true,
      },
    });

    if (!event) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, eventId, {
          values,
          error: "Event not found in the selected organization.",
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
        buildErrorRedirectUrl(request.url, eventId, {
          values,
          fieldErrors: {
            personId: "Select a valid person in the active organization.",
          },
          error: "Person selection is invalid.",
        }),
        303,
      );
    }

    if (event.teamId) {
      const teamSeasons = await db.season.findMany({
        where: {
          organizationId: scope.organizationId,
          programId: event.programId,
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      });
      const selectedSeason = selectSeededOrCurrentSeason(teamSeasons);

      if (selectedSeason) {
        const rosterMembership = await db.rosterMembership.findUnique({
          where: {
            teamId_seasonId_personId: {
              teamId: event.teamId,
              seasonId: selectedSeason.id,
              personId: person.id,
            },
          },
          select: {
            id: true,
          },
        });

        if (!rosterMembership) {
          return NextResponse.redirect(
            buildErrorRedirectUrl(request.url, eventId, {
              values,
              fieldErrors: {
                personId: `Select a person on the ${selectedSeason.name} roster for this team event.`,
              },
              error: "Attendance person must match the selected team roster context.",
            }),
            303,
          );
        }
      }
    }

    const markedByPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!markedByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, eventId, {
          values,
          error: "No organization person is available for attendance marked-by attribution yet.",
        }),
        303,
      );
    }

    const markedAt = new Date();

    await db.attendanceRecord.upsert({
      where: {
        eventId_personId: {
          eventId: event.id,
          personId: person.id,
        },
      },
      create: {
        organizationId: event.organizationId,
        eventId: event.id,
        personId: person.id,
        status: parsed.data.status,
        reasonCode: parsed.data.reasonCode,
        markedByPersonId,
        markedAt,
      },
      update: {
        status: parsed.data.status,
        reasonCode: parsed.data.reasonCode,
        markedByPersonId,
        markedAt,
      },
    });

    const continueCapture = values.continueCapture === "1";

    if (continueCapture) {
      const continueCaptureRedirectUrl = new URL(`/events/${event.id}`, request.url);
      continueCaptureRedirectUrl.searchParams.set("attendanceStatus", parsed.data.status);
      continueCaptureRedirectUrl.searchParams.set("attendanceReasonCode", parsed.data.reasonCode ?? "");
      if (values.attendanceView) {
        continueCaptureRedirectUrl.searchParams.set("attendanceView", values.attendanceView);
      }
      continueCaptureRedirectUrl.searchParams.set("attendanceContinue", "1");
      continueCaptureRedirectUrl.searchParams.set("attendanceSaved", "1");
      continueCaptureRedirectUrl.hash = "attendance-capture-form";

      return NextResponse.redirect(continueCaptureRedirectUrl, 303);
    }

    return NextResponse.redirect(new URL(`/events/${event.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, eventId, {
          values,
          error: "Attendance references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before saving attendance."
            : "Unable to save attendance right now. Please try again.",
      }),
      303,
    );
  }
}
