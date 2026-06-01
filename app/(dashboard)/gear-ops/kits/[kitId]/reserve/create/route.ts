import {
  ApprovalStatus,
  GearReservationApprovalState,
  GearReservationApprovalType,
  GearReservationMode,
  GearReservationPurpose,
  GearReservationStatus,
  GearReservationWorkflowStatus,
  InventoryMovementType,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kitId: string }> },
) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.reserve",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const reservedForPersonId = (formData.get("reservedForPersonId") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const windowStartAtRaw = (formData.get("windowStartAt") as string | null)?.trim() ?? "";
  const windowEndAtRaw = (formData.get("windowEndAt") as string | null)?.trim() ?? "";

  const windowStartAt = windowStartAtRaw ? new Date(windowStartAtRaw) : null;
  const windowEndAt = windowEndAtRaw ? new Date(windowEndAtRaw) : null;

  if (!reservedForPersonId || !windowStartAt || !windowEndAt || Number.isNaN(windowStartAt.getTime()) || Number.isNaN(windowEndAt.getTime()) || windowEndAt <= windowStartAt) {
    redirect(`/gear-ops/kits/${kitId}/reserve`);
  }

  const requestedByPersonId = await resolveActorPersonId({
    organizationId: scope.organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  if (!requestedByPersonId) {
    redirect(`/gear-ops/kits/${kitId}/reserve`);
  }

  const kit = await db.inventoryKit.findFirst({
    where: { id: kitId, organizationId: scope.organizationId },
    select: {
      id: true,
      items: {
        where: { removedAt: null },
        select: {
          gearItem: {
            select: {
              id: true,
              lifecycleStatus: true,
              checkouts: { where: { status: { in: ["OPEN", "OVERDUE"] } }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!kit) {
    redirect(`/gear-ops/kits`);
  }

  await db.$transaction(async (tx) => {
    for (const member of kit.items) {
      const hasOpenCheckout = member.gearItem.checkouts.length > 0;
      const hasOutOfService = ["MAINTENANCE", "QUARANTINED", "RETIRED", "LOST"].includes(member.gearItem.lifecycleStatus);
      const status = hasOpenCheckout || hasOutOfService ? GearReservationStatus.CONFLICT : GearReservationStatus.ACTIVE;
      const conflictSummary = hasOutOfService
        ? "Kit member is out of service."
        : hasOpenCheckout
          ? "Kit member is currently checked out."
          : null;

      const reservation = await tx.gearReservation.create({
        data: {
          organizationId: scope.organizationId,
          gearItemId: member.gearItem.id,
          inventoryKitId: kit.id,
          requestedByPersonId,
          reservedForPersonId,
          requestedForPersonId: reservedForPersonId,
          mode: GearReservationMode.HARD_RESERVATION,
          purpose: GearReservationPurpose.OPERATIONAL,
          status,
          workflowStatus:
            status === GearReservationStatus.CONFLICT
              ? GearReservationWorkflowStatus.PENDING_APPROVAL
              : GearReservationWorkflowStatus.REQUESTED,
          approvalStatus:
            status === GearReservationStatus.CONFLICT
              ? ApprovalStatus.PENDING
              : ApprovalStatus.NOT_REQUIRED,
          requestSourceRole: "STAFF",
          createdByPersonId: requestedByPersonId,
          quantityRequested: 1,
          windowStartAt,
          windowEndAt,
          requestedStartAt: windowStartAt,
          expectedReturnAt: windowEndAt,
          notes,
          conflictSummary,
        },
      });

      await tx.gearReservationApproval.createMany({
        data: [
          {
            organizationId: scope.organizationId,
            reservationId: reservation.id,
            approvalType: GearReservationApprovalType.AVAILABILITY,
            approvalStatus:
              status === GearReservationStatus.CONFLICT
                ? GearReservationApprovalState.FAILED
                : GearReservationApprovalState.PASSED,
            approvalActorRole: "SYSTEM",
            notes:
              status === GearReservationStatus.CONFLICT
                ? "Kit member availability check failed."
                : "Kit member availability check passed.",
            isAutomated: true,
          },
          {
            organizationId: scope.organizationId,
            reservationId: reservation.id,
            approvalType: GearReservationApprovalType.CONDITION,
            approvalStatus: hasOutOfService
              ? GearReservationApprovalState.FAILED
              : GearReservationApprovalState.PASSED,
            approvalActorRole: "SYSTEM",
            notes: hasOutOfService
              ? "Kit member condition/readiness check failed."
              : "Kit member condition/readiness check passed.",
            isAutomated: true,
          },
        ],
      });

      await tx.inventoryMovement.create({
        data: {
          organizationId: scope.organizationId,
          gearItemId: member.gearItem.id,
          movementType: InventoryMovementType.RESERVED,
          actorPersonId: requestedByPersonId,
          relatedRecordType: "GEAR_RESERVATION",
          relatedRecordId: reservation.id,
          notes: `Reserved via static kit ${kit.id}${conflictSummary ? ` · ${conflictSummary}` : ""}`,
          occurredAt: new Date(),
        },
      });
    }
  });

  redirect(`/gear-ops/kits/${kitId}`);
}
