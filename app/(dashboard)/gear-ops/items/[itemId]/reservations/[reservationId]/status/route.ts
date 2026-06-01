import {
  ApprovalStatus,
  GearReservationApprovalState,
  GearReservationApprovalType,
  GearReservationStatus,
  InventoryMovementType,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { deriveReservationWorkflowStatus } from "@/lib/gear-reservation-foundation";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, itemId: string, status: string, error?: string) {
  const url = new URL(`/gear-ops/items/${itemId}`, requestUrl);
  if (status) {
    url.searchParams.set("reservationStatusUpdated", status);
  }
  if (error) {
    url.searchParams.set("reservationError", error);
  }
  return url;
}

function buildManualApprovalRecord(input: {
  organizationId: string;
  reservationId: string;
  actorPersonId: string;
  nextStatus: GearReservationStatus;
  reason: string;
}) {
  return {
    organizationId: input.organizationId,
    reservationId: input.reservationId,
    approvalType: GearReservationApprovalType.COACH_ADMIN_APPROVAL,
    approvalStatus:
      input.nextStatus === GearReservationStatus.ACTIVE
        ? GearReservationApprovalState.APPROVED
        : GearReservationApprovalState.DENIED,
    approvalActorRole: "COACH_OR_ADMIN",
    approvedByPersonId: input.actorPersonId,
    approvedAt: new Date(),
    notes:
      input.reason.length > 0
        ? input.reason
        : input.nextStatus === GearReservationStatus.ACTIVE
          ? "Approved from reservation status control."
          : "Denied from reservation status control.",
    isAutomated: false,
  } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string; reservationId: string }> },
) {
  const { itemId, reservationId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const nextStatus = getStringField(formData, "status");
  const reason = getStringField(formData, "reason");

  if (!scope.databaseReady) {
    return NextResponse.redirect(buildRedirectUrl(request.url, itemId, nextStatus, scope.errorMessage ?? "Unable to update reservation right now."), 303);
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(buildRedirectUrl(request.url, itemId, nextStatus, "No organization context is available yet."), 303);
  }
  const organizationId = scope.organizationId;

  const allowedStatuses = new Set<GearReservationStatus>([
    GearReservationStatus.ACTIVE,
    GearReservationStatus.PENDING_REVIEW,
    GearReservationStatus.RELEASED,
    GearReservationStatus.CANCELED,
    GearReservationStatus.FULFILLED,
    GearReservationStatus.EXPIRED,
  ]);

  if (!allowedStatuses.has(nextStatus as GearReservationStatus)) {
    return NextResponse.redirect(buildRedirectUrl(request.url, itemId, nextStatus, "Unsupported reservation status transition."), 303);
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearReservation.update",
    });

    const actorPersonId = await resolveActorPersonId({
      organizationId: organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!actorPersonId) {
      return NextResponse.redirect(buildRedirectUrl(request.url, itemId, nextStatus, "No organization person is available for reservation updates yet."), 303);
    }

    const access = await resolveGearOpsReadAccess({
      organizationId,
      actorPersonId,
      workflow: "gear-ops.reservation-status.update",
    });

    if (!access.allowed) {
      return NextResponse.redirect(
        buildRedirectUrl(
          request.url,
          itemId,
          nextStatus,
          access.denialMessage ?? "You do not have access to update this reservation.",
        ),
        303,
      );
    }

    const reservation = await db.gearReservation.findFirst({
      where: {
        id: reservationId,
        gearItemId: itemId,
        organizationId: organizationId,
        gearItem: { AND: [access.where] },
      },
      select: { id: true, gearItemId: true },
    });

    if (!reservation) {
      return NextResponse.redirect(buildRedirectUrl(request.url, itemId, nextStatus, "Reservation not found in this organization."), 303);
    }

    await db.$transaction(async (tx) => {
      await tx.gearReservation.update({
        where: { id: reservation.id },
        data: {
          status: nextStatus as GearReservationStatus,
          workflowStatus: deriveReservationWorkflowStatus(nextStatus as GearReservationStatus),
          approvalStatus:
            nextStatus === GearReservationStatus.ACTIVE
              ? ApprovalStatus.APPROVED
              : nextStatus === GearReservationStatus.PENDING_REVIEW
                ? ApprovalStatus.PENDING
                : undefined,
          approvedByPersonId: nextStatus === GearReservationStatus.ACTIVE ? actorPersonId : undefined,
          releasedByPersonId:
            nextStatus === GearReservationStatus.RELEASED ||
            nextStatus === GearReservationStatus.CANCELED ||
            nextStatus === GearReservationStatus.EXPIRED ||
            nextStatus === GearReservationStatus.FULFILLED
              ? actorPersonId
              : undefined,
          releasedAt:
            nextStatus === GearReservationStatus.RELEASED ||
            nextStatus === GearReservationStatus.CANCELED ||
            nextStatus === GearReservationStatus.EXPIRED
              ? new Date()
              : undefined,
          fulfilledAt: nextStatus === GearReservationStatus.FULFILLED ? new Date() : undefined,
          releaseReason: reason.length > 0 ? reason : undefined,
        },
      });

      if (
        nextStatus === GearReservationStatus.RELEASED ||
        nextStatus === GearReservationStatus.CANCELED ||
        nextStatus === GearReservationStatus.EXPIRED ||
        nextStatus === GearReservationStatus.FULFILLED
      ) {
        await tx.inventoryMovement.create({
          data: {
            organizationId: organizationId!,
            gearItemId: itemId,
            movementType: InventoryMovementType.RESERVATION_RELEASED,
            actorPersonId,
            relatedRecordType: "GEAR_RESERVATION",
            relatedRecordId: reservation.id,
            notes: reason.length > 0 ? reason : `Reservation marked ${nextStatus.toLowerCase()}.`,
            occurredAt: new Date(),
          },
        });
      }

      if (nextStatus === GearReservationStatus.ACTIVE || nextStatus === GearReservationStatus.CANCELED) {
        await tx.gearReservationApproval.create({
          data: buildManualApprovalRecord({
            organizationId,
            reservationId: reservation.id,
            actorPersonId,
            nextStatus: nextStatus as GearReservationStatus,
            reason,
          }),
        });
      }
    });

    return NextResponse.redirect(buildRedirectUrl(request.url, itemId, nextStatus), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        itemId,
        nextStatus,
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before updating reservations."
            : "Unable to update reservation right now. Please try again.",
      ),
      303,
    );
  }
}
