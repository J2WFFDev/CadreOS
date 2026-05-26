import { NextResponse } from "next/server";
import { GearReservationStatus, InventoryMovementType } from "@prisma/client";

import { db } from "@/lib/db";
import { findReservationToFulfill } from "@/lib/gear-reservations";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";
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
  input: {
    values: GearAssignmentFormValues;
    fieldErrors?: Partial<Record<keyof GearAssignmentFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/assign`, requestUrl);

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
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
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
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: scope.errorMessage ?? "Unable to create assignment right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
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
      buildErrorRedirectUrl(request.url, itemId, {
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
      organizationId,
      action: "gearAssignment.create",
    });

    // Verify item belongs to this organization
    const item = await db.gearItem.findFirst({
      where: { id: itemId, organizationId },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "Gear item not found in this organization.",
        }),
        303,
      );
    }

    // Cross-org reference guard: person
    if (parsed.data.assignedToPersonId) {
      const person = await db.person.findFirst({
        where: { id: parsed.data.assignedToPersonId, organizationId },
        select: { id: true },
      });

      if (!person) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
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
        where: { id: parsed.data.assignedToTeamId, organizationId },
        select: { id: true },
      });

      if (!team) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
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
        where: { id: parsed.data.assignedToEventId, organizationId },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
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

    const assignedByPersonId = await resolveActorPersonId({
      organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!assignedByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "No organization person is available for assignment attribution yet.",
        }),
        303,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.gearAssignment.create({
        data: {
          organizationId,
          gearItemId: itemId,
          assignedByPersonId,
          status: parsed.data.status,
          assignedToPersonId: parsed.data.assignedToPersonId,
          assignedToTeamId: parsed.data.assignedToTeamId,
          assignedToEventId: parsed.data.assignedToEventId,
          expectedReturnAt: parsed.data.expectedReturnAt,
          returnedAt: parsed.data.returnedAt,
          notes: parsed.data.notes,
        },
      });

      const reservations = await tx.gearReservation.findMany({
        where: {
          organizationId,
          gearItemId: itemId,
          status: {
            in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW, GearReservationStatus.CONFLICT],
          },
        },
        select: {
          id: true,
          gearItemId: true,
          mode: true,
          status: true,
          approvalStatus: true,
          holdType: true,
          purpose: true,
          quantityRequested: true,
          windowStartAt: true,
          windowEndAt: true,
          reservedForPersonId: true,
          reservedForTeamId: true,
          reservedForEventId: true,
          programId: true,
          conflictSummary: true,
        },
      });

      const reservationToFulfill = findReservationToFulfill({
        reservations,
        personId: parsed.data.assignedToPersonId,
        teamId: parsed.data.assignedToTeamId,
        eventId: parsed.data.assignedToEventId,
      });

      if (reservationToFulfill) {
        await tx.gearReservation.update({
          where: { id: reservationToFulfill.id },
          data: {
            status: GearReservationStatus.FULFILLED,
            fulfilledAt: new Date(),
            releasedByPersonId: assignedByPersonId,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            organizationId,
            gearItemId: itemId,
            movementType: InventoryMovementType.RESERVATION_RELEASED,
            actorPersonId: assignedByPersonId,
            relatedRecordType: "GEAR_RESERVATION",
            relatedRecordId: reservationToFulfill.id,
            notes: "Reservation fulfilled by gear assignment.",
            occurredAt: new Date(),
          },
        });
      }
    });

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating assignments."
            : "Unable to create assignment right now. Please try again.",
      }),
      303,
    );
  }
}
