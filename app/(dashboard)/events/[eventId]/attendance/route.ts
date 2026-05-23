import { Prisma, RoleType, ScopeType } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  attendanceWorkflowSchema,
  getStringField,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/phase1c/workflows";

function buildErrorRedirectUrl(requestUrl: string, eventId: string, input: {
  values: { personId: string; status: string; reasonCode: string };
  fieldErrors?: Partial<Record<"personId" | "status" | "reasonCode", string>>;
  error?: string;
}) {
  const url = new URL(`/events/${eventId}`, requestUrl);

  url.searchParams.set("attendancePersonId", input.values.personId);
  url.searchParams.set("attendanceStatus", input.values.status);
  url.searchParams.set("attendanceReasonCode", input.values.reasonCode);

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

async function resolveAttendanceMarkerPersonId(organizationId: string, actorUserId: string): Promise<string | null> {
  const linkedUserAccount = await db.userAccount.findFirst({
    where: {
      organizationId,
      clerkUserId: actorUserId,
      personId: { not: null },
    },
    select: { personId: true },
  });

  if (linkedUserAccount?.personId) {
    return linkedUserAccount.personId;
  }

  const organizationAdminAssignment = await db.roleAssignment.findFirst({
    where: {
      organizationId,
      roleType: RoleType.ORGANIZATION_ADMIN,
      scopeType: ScopeType.ORGANIZATION,
    },
    select: { personId: true },
    orderBy: [{ createdAt: "asc" }],
  });

  if (organizationAdminAssignment?.personId) {
    return organizationAdminAssignment.personId;
  }

  const firstPerson = await db.person.findFirst({
    where: { organizationId },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  });

  return firstPerson?.id ?? null;
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

    const authContext = await requireAuthContext();
    const markedByPersonId = await resolveAttendanceMarkerPersonId(scope.organizationId, authContext.userId);

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
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before saving attendance."
          : "Unable to save attendance right now. Please try again.",
      }),
      303,
    );
  }
}
