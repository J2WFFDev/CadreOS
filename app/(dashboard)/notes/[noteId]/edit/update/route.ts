import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  noteWorkflowSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, noteId: string, input: {
  values: { body: string; athletePersonId: string; teamId: string; eventId: string };
  fieldErrors?: Partial<Record<"body" | "athletePersonId" | "teamId" | "eventId", string>>;
  error?: string;
}) {
  const url = new URL(`/notes/${noteId}/edit`, requestUrl);

  url.searchParams.set("body", input.values.body);
  url.searchParams.set("athletePersonId", input.values.athletePersonId);
  url.searchParams.set("teamId", input.values.teamId);
  url.searchParams.set("eventId", input.values.eventId);

  if (input.fieldErrors?.body) {
    url.searchParams.set("bodyError", input.fieldErrors.body);
  }
  if (input.fieldErrors?.athletePersonId) {
    url.searchParams.set("athletePersonIdError", input.fieldErrors.athletePersonId);
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const { noteId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    body: getStringField(formData, "body"),
    athletePersonId: getStringField(formData, "athletePersonId"),
    teamId: getStringField(formData, "teamId"),
    eventId: getStringField(formData, "eventId"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, noteId, {
        values,
        error: scope.errorMessage ?? "Unable to update note right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, noteId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = noteWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, noteId, {
        values,
        fieldErrors: {
          body: fieldErrors.body?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "note.update",
      noteId,
      teamId: parsed.data.teamId,
      eventId: parsed.data.eventId,
    });

    if (parsed.data.athletePersonId) {
      const athlete = await db.person.findFirst({
        where: {
          id: parsed.data.athletePersonId,
          organizationId: scope.organizationId,
        },
        select: { id: true },
      });

      if (!athlete) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, noteId, {
            values,
            fieldErrors: { athletePersonId: "Select a valid person in the active organization." },
            error: "Person selection is invalid.",
          }),
          303,
        );
      }
    }

    if (parsed.data.teamId) {
      const team = await db.team.findFirst({
        where: {
          id: parsed.data.teamId,
          organizationId: scope.organizationId,
        },
        select: { id: true },
      });

      if (!team) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, noteId, {
            values,
            fieldErrors: { teamId: "Select a valid team in the active organization." },
            error: "Team selection is invalid.",
          }),
          303,
        );
      }
    }

    if (parsed.data.eventId) {
      const event = await db.event.findFirst({
        where: {
          id: parsed.data.eventId,
          organizationId: scope.organizationId,
        },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, noteId, {
            values,
            fieldErrors: { eventId: "Select a valid event in the active organization." },
            error: "Event selection is invalid.",
          }),
          303,
        );
      }
    }

    const updated = await db.observationNote.updateMany({
      where: {
        id: noteId,
        organizationId: scope.organizationId,
      },
      data: {
        body: parsed.data.body,
        athletePersonId: parsed.data.athletePersonId,
        teamId: parsed.data.teamId,
        eventId: parsed.data.eventId,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, noteId, {
          values,
          error: "Note not found in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/notes/${noteId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, noteId, {
          values,
          error: "Note references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, noteId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing notes."
            : "Unable to update note right now. Please try again.",
      }),
      303,
    );
  }
}
