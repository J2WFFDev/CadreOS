import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeObservationNoteEntryRuntimeRef } from "@/lib/entry-runtime";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  noteWorkflowSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";
import { resolveActorPersonId } from "@/lib/user-account";

function buildErrorRedirectUrl(requestUrl: string, input: {
  values: { body: string; athletePersonId: string; teamId: string; eventId: string };
  fieldErrors?: Partial<Record<"body" | "athletePersonId" | "teamId" | "eventId", string>>;
  error?: string;
}) {
  const url = new URL("/notes/new", requestUrl);

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

export async function POST(request: Request) {
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
      buildErrorRedirectUrl(request.url, {
        values,
        error: scope.errorMessage ?? "Unable to create note right now.",
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

  const parsed = noteWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
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
      action: "note.create",
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
          buildErrorRedirectUrl(request.url, {
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
          buildErrorRedirectUrl(request.url, {
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
        select: { id: true, teamId: true },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: { eventId: "Select a valid event in the active organization." },
            error: "Event selection is invalid.",
          }),
          303,
        );
      }

      if (parsed.data.teamId && parsed.data.teamId !== event.teamId) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, {
            values,
            fieldErrors: { teamId: "Selected team must match the linked event team." },
            error: "Team and event context is ambiguous.",
          }),
          303,
        );
      }
    }

    const authorPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!authorPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "No organization person is available for note author attribution yet.",
        }),
        303,
      );
    }

    const createdNote = await db.observationNote.create({
      data: {
        organizationId: scope.organizationId,
        authorPersonId,
        body: parsed.data.body,
        athletePersonId: parsed.data.athletePersonId,
        teamId: parsed.data.teamId,
        eventId: parsed.data.eventId,
      },
      select: {
        id: true,
        organizationId: true,
        authorPersonId: true,
        visibility: true,
        athletePersonId: true,
        teamId: true,
        eventId: true,
      },
    });

    try {
      await writeObservationNoteEntryRuntimeRef({
        organizationId: scope.organizationId,
        note: createdNote,
      });
    } catch {
      // Phase 10A sidecar writes are intentionally non-authoritative and fail-safe.
    }

    return NextResponse.redirect(new URL(`/notes/${createdNote.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          error: "Note references are invalid for the selected organization.",
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
            ? "Database schema is not available yet. Run database setup before creating notes."
            : "Unable to create note right now. Please try again.",
      }),
      303,
    );
  }
}
