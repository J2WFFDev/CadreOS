import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearAssignmentWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearAssignmentFormValues = {
  status: string;
  assignedToPersonId: string;
  assignedToTeamId: string;
  assignedToEventId: string;
  expectedReturnAt: string;
  returnedAt: string;
  notes: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  assignmentId: string,
  input: {
    values: GearAssignmentFormValues;
    fieldErrors?: Partial<Record<keyof GearAssignmentFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/assignments/${assignmentId}/edit`, requestUrl);

  Object.entries(input.values).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (input.fieldErrors) {
    Object.entries(input.fieldErrors).forEach(([key, message]) => {
      if (message) {
        url.searchParams.set(`${key}Error`, message);
      }
    });
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string; assignmentId: string }> },
) {
  const { itemId, assignmentId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: GearAssignmentFormValues = {
    status: getStringField(formData, "status"),
    assignedToPersonId: getStringField(formData, "assignedToPersonId"),
    assignedToTeamId: getStringField(formData, "assignedToTeamId"),
    assignedToEventId: getStringField(formData, "assignedToEventId"),
    expectedReturnAt: getStringField(formData, "expectedReturnAt"),
    returnedAt: getStringField(formData, "returnedAt"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, assignmentId, {
        values,
        error: scope.errorMessage ?? "Unable to update assignment right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, assignmentId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = gearAssignmentWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, assignmentId, {
        values,
        fieldErrors: {
          status: fieldErrors.status?.[0],
          assignedToPersonId: fieldErrors.assignedToPersonId?.[0],
          assignedToTeamId: fieldErrors.assignedToTeamId?.[0],
          assignedToEventId: fieldErrors.assignedToEventId?.[0],
          expectedReturnAt: fieldErrors.expectedReturnAt?.[0],
          returnedAt: fieldErrors.returnedAt?.[0],
          notes: fieldErrors.notes?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearAssignment.update",
    });

    // Cross-org reference guard: person
    if (parsed.data.assignedToPersonId) {
      const person = await db.person.findFirst({
        where: { id: parsed.data.assignedToPersonId, organizationId: organizationId },
        select: { id: true },
      });

      if (!person) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, assignmentId, {
            values,
            fieldErrors: {
              assignedToPersonId: "The selected person does not exist in this organization.",
            },
            error: "Person not found in this organization.",
          }),
          303,
        );
      }
    }

    // Cross-org reference guard: team
    if (parsed.data.assignedToTeamId) {
      const team = await db.team.findFirst({
        where: { id: parsed.data.assignedToTeamId, organizationId: organizationId },
        select: { id: true },
      });

      if (!team) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, assignmentId, {
            values,
            fieldErrors: {
              assignedToTeamId: "The selected team does not exist in this organization.",
            },
            error: "Team not found in this organization.",
          }),
          303,
        );
      }
    }

    // Cross-org reference guard: event
    if (parsed.data.assignedToEventId) {
      const event = await db.event.findFirst({
        where: { id: parsed.data.assignedToEventId, organizationId: organizationId },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, assignmentId, {
            values,
            fieldErrors: {
              assignedToEventId: "The selected event does not exist in this organization.",
            },
            error: "Event not found in this organization.",
          }),
          303,
        );
      }
    }

    const updated = await db.gearAssignment.updateMany({
      where: {
        id: assignmentId,
        gearItemId: itemId,
        organizationId: organizationId,
      },
      data: {
        status: parsed.data.status,
        assignedToPersonId: parsed.data.assignedToPersonId,
        assignedToTeamId: parsed.data.assignedToTeamId,
        assignedToEventId: parsed.data.assignedToEventId,
        expectedReturnAt: parsed.data.expectedReturnAt,
        returnedAt: parsed.data.returnedAt,
        notes: parsed.data.notes,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, assignmentId, {
          values,
          error: "Assignment not found for this gear item in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, assignmentId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing assignments."
            : "Unable to update assignment right now. Please try again.",
      }),
      303,
    );
  }
}
