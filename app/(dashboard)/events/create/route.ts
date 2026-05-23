import { EventStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  eventWorkflowSchema,
  getStringField,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";
import { resolveActorPersonId } from "@/lib/user-account";

function buildErrorRedirectUrl(requestUrl: string, input: {
  values: {
    title: string;
    eventType: string;
    status: string;
    programId: string;
    teamId: string;
    startsAt: string;
    endsAt: string;
    location: string;
  };
  fieldErrors?: Partial<Record<"title" | "eventType" | "status" | "programId" | "teamId" | "startsAt" | "endsAt" | "location", string>>;
  error?: string;
}) {
  const url = new URL("/events/new", requestUrl);

  url.searchParams.set("title", input.values.title);
  url.searchParams.set("eventType", input.values.eventType);
  url.searchParams.set("status", input.values.status);
  url.searchParams.set("programId", input.values.programId);
  url.searchParams.set("teamId", input.values.teamId);
  url.searchParams.set("startsAt", input.values.startsAt);
  url.searchParams.set("endsAt", input.values.endsAt);
  url.searchParams.set("location", input.values.location);

  if (input.fieldErrors?.title) {
    url.searchParams.set("titleError", input.fieldErrors.title);
  }
  if (input.fieldErrors?.eventType) {
    url.searchParams.set("eventTypeError", input.fieldErrors.eventType);
  }
  if (input.fieldErrors?.status) {
    url.searchParams.set("statusError", input.fieldErrors.status);
  }
  if (input.fieldErrors?.programId) {
    url.searchParams.set("programIdError", input.fieldErrors.programId);
  }
  if (input.fieldErrors?.teamId) {
    url.searchParams.set("teamIdError", input.fieldErrors.teamId);
  }
  if (input.fieldErrors?.startsAt) {
    url.searchParams.set("startsAtError", input.fieldErrors.startsAt);
  }
  if (input.fieldErrors?.endsAt) {
    url.searchParams.set("endsAtError", input.fieldErrors.endsAt);
  }
  if (input.fieldErrors?.location) {
    url.searchParams.set("locationError", input.fieldErrors.location);
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
    title: getStringField(formData, "title"),
    eventType: getStringField(formData, "eventType"),
    status: getStringField(formData, "status") || EventStatus.DRAFT,
    programId: getStringField(formData, "programId"),
    teamId: getStringField(formData, "teamId"),
    startsAt: getStringField(formData, "startsAt"),
    endsAt: getStringField(formData, "endsAt"),
    location: getStringField(formData, "location"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: scope.errorMessage ?? "Unable to create event right now.",
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

  const parsed = eventWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        fieldErrors: {
          title: fieldErrors.title?.[0],
          eventType: fieldErrors.eventType?.[0],
          status: fieldErrors.status?.[0],
          programId: fieldErrors.programId?.[0],
          teamId: fieldErrors.teamId?.[0],
          startsAt: fieldErrors.startsAt?.[0],
          endsAt: fieldErrors.endsAt?.[0],
          location: fieldErrors.location?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "event.create",
    });

    const program = await db.program.findFirst({
      where: {
        id: parsed.data.programId,
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

    if (parsed.data.teamId) {
      const team = await db.team.findFirst({
        where: {
          id: parsed.data.teamId,
          organizationId: scope.organizationId,
          programId: parsed.data.programId,
        },
        select: { id: true },
      });

      if (!team) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: {
              teamId: "Select a team that belongs to the selected program.",
            },
            error: "Team selection is invalid for the selected program.",
          }),
          303,
        );
      }
    }

    const authContext = await requireAuthContext();
    const createdByPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: authContext.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!createdByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "No organization person is available for created-by attribution yet.",
        }),
        303,
      );
    }

    const createdEvent = await db.event.create({
      data: {
        organizationId: scope.organizationId,
        title: parsed.data.title,
        eventType: parsed.data.eventType,
        status: parsed.data.status,
        programId: parsed.data.programId,
        teamId: parsed.data.teamId,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        location: parsed.data.location,
        createdByPersonId,
      },
      select: { id: true },
    });

    return NextResponse.redirect(new URL(`/events/${createdEvent.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "Event references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before creating events."
          : "Unable to create event right now. Please try again.",
      }),
      303,
    );
  }
}
