import { Prisma, RSVPStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  rsvpWorkflowSchema,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, eventId: string, input: {
  values: { personId: string; status: string; reason: string };
  fieldErrors?: Partial<Record<"personId" | "status" | "reason", string>>;
  error?: string;
}) {
  const url = new URL(`/events/${eventId}`, requestUrl);

  url.searchParams.set("rsvpPersonId", input.values.personId);
  url.searchParams.set("rsvpStatus", input.values.status);
  url.searchParams.set("rsvpReason", input.values.reason);

  if (input.fieldErrors?.personId) {
    url.searchParams.set("rsvpPersonIdError", input.fieldErrors.personId);
  }

  if (input.fieldErrors?.status) {
    url.searchParams.set("rsvpStatusError", input.fieldErrors.status);
  }

  if (input.fieldErrors?.reason) {
    url.searchParams.set("rsvpReasonError", input.fieldErrors.reason);
  }

  if (input.error) {
    url.searchParams.set("rsvpError", input.error);
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
    status: getStringField(formData, "status") || RSVPStatus.MAYBE,
    reason: getStringField(formData, "reason"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        error: scope.errorMessage ?? "Unable to save RSVP right now.",
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

  const parsed = rsvpWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        fieldErrors: {
          personId: fieldErrors.personId?.[0],
          status: fieldErrors.status?.[0],
          reason: fieldErrors.reason?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "rsvp.upsert",
    });

    const event = await db.event.findFirst({
      where: {
        id: eventId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        organizationId: true,
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

    const respondedAt = new Date();

    await db.rSVP.upsert({
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
        reason: parsed.data.reason,
        respondedAt,
      },
      update: {
        status: parsed.data.status,
        reason: parsed.data.reason,
        respondedAt,
      },
    });

    return NextResponse.redirect(new URL(`/events/${event.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, eventId, {
          values,
          error: "RSVP references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, eventId, {
        values,
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before saving RSVPs."
          : "Unable to save RSVP right now. Please try again.",
      }),
      303,
    );
  }
}
