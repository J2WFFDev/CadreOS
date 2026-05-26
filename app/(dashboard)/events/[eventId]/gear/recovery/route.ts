import {
  EventGearPlanStatus,
  GearConditionStatus,
  GearMaintenanceType,
  InventoryMovementType,
  InventoryReadinessState,
} from "@/lib/prisma-client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { recordInventoryMovement } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const schema = z.object({
  eventGearAssignmentId: z.string().trim().min(1),
  recoveredToLocationId: z.string().trim().optional(),
  conditionOnRecovery: z.nativeEnum(GearConditionStatus).optional().or(z.literal("")),
  recoveryNotes: z.string().trim().max(4000).optional(),
  maintenanceFlag: z.string().trim().optional(),
});

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function redirectTo(requestUrl: string, eventId: string, input: Record<string, string>) {
  const url = new URL(`/events/${eventId}/gear`, requestUrl);
  Object.entries(input).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  url.hash = "recovery-review";
  return url;
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    eventGearAssignmentId: getStringField(formData, "eventGearAssignmentId"),
    recoveredToLocationId: getStringField(formData, "recoveredToLocationId"),
    conditionOnRecovery: getStringField(formData, "conditionOnRecovery"),
    recoveryNotes: getStringField(formData, "recoveryNotes"),
    maintenanceFlag: getStringField(formData, "maintenanceFlag"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { recoveryError: scope.errorMessage ?? "Unable to recover event gear right now." }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(redirectTo(request.url, eventId, { recoveryError: "No organization context is available yet." }), 303);
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { recoveryError: parsed.error.issues[0]?.message ?? "Please review the recovery details." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "eventGearAssignment.update",
      eventId,
    });

    const assignment = await db.eventGearAssignment.findFirst({
      where: {
        id: parsed.data.eventGearAssignmentId,
        organizationId: scope.organizationId,
        plan: { eventId },
      },
      select: {
        id: true,
        planId: true,
        gearItemId: true,
        plan: {
          select: {
            id: true,
            recoveryLocationId: true,
            assignments: { select: { id: true, recoveredAt: true } },
            event: { select: { id: true, title: true } },
          },
        },
        gearItem: {
          select: {
            id: true,
            name: true,
            locationId: true,
            conditionStatus: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.redirect(redirectTo(request.url, eventId, { recoveryError: "Event gear assignment not found." }), 303);
    }

    const recoveredToLocationId = normalizeOptional(parsed.data.recoveredToLocationId ?? "") ?? assignment.plan.recoveryLocationId;
    if (recoveredToLocationId) {
      const location = await db.inventoryLocation.findFirst({
        where: { id: recoveredToLocationId, organizationId: scope.organizationId },
        select: { id: true },
      });
      if (!location) {
        return NextResponse.redirect(
          redirectTo(request.url, eventId, { recoveryError: "The selected recovery location is not available in this organization." }),
          303,
        );
      }
    }

    const actorPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!actorPersonId) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { recoveryError: "No organization person is available for recovery attribution yet." }),
        303,
      );
    }

    const latestCheckout = await db.gearCheckout.findFirst({
      where: {
        organizationId: scope.organizationId,
        gearItemId: assignment.gearItemId,
        eventId,
      },
      orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, status: true, returnedAt: true },
    });

    if (latestCheckout && (latestCheckout.status === "OPEN" || latestCheckout.status === "OVERDUE") && latestCheckout.returnedAt === null) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { recoveryError: "Return the event checkout before completing recovery." }),
        303,
      );
    }

    const maintenanceFlag = parsed.data.maintenanceFlag === "on";
    const conditionOnRecovery = normalizeOptional(parsed.data.conditionOnRecovery ?? "") as GearConditionStatus | null;
    const now = new Date();

    const updated = await db.eventGearAssignment.update({
      where: { id: assignment.id },
      data: {
        recoveredAt: now,
        recoveredByPersonId: actorPersonId,
        recoveredToLocationId: recoveredToLocationId ?? null,
        conditionOnRecovery,
        maintenanceFlag,
        recoveryNotes: normalizeOptional(parsed.data.recoveryNotes ?? ""),
      },
    });

    await recordInventoryMovement({
      organizationId: scope.organizationId,
      gearItemId: assignment.gearItemId,
      movementType:
        latestCheckout && latestCheckout.returnedAt
          ? InventoryMovementType.CHECKED_IN
          : InventoryMovementType.MOVED_TO_LOCATION,
      actorPersonId,
      fromLocationId: assignment.gearItem.locationId,
      toLocationId: recoveredToLocationId,
      relatedRecordType: "EVENT_GEAR_PLAN",
      relatedRecordId: assignment.planId,
      notes: `Recovered from event ${assignment.plan.event.title}`,
      updateLocationId: recoveredToLocationId ?? undefined,
    });

    const gearItemUpdate: Record<string, unknown> = {};
    if (conditionOnRecovery) {
      gearItemUpdate.conditionStatus = conditionOnRecovery;
    }
    if (maintenanceFlag || conditionOnRecovery === "POOR" || conditionOnRecovery === "DAMAGED") {
      gearItemUpdate.readinessState = InventoryReadinessState.MAINTENANCE_REQUIRED;
      gearItemUpdate.lifecycleStatus = "MAINTENANCE";
    }

    if (Object.keys(gearItemUpdate).length > 0) {
      await db.gearItem.update({
        where: { id: assignment.gearItemId },
        data: gearItemUpdate,
      });
    }

    if (maintenanceFlag || conditionOnRecovery === "POOR" || conditionOnRecovery === "DAMAGED") {
      await db.gearMaintenanceLog.create({
        data: {
          organizationId: scope.organizationId,
          gearItemId: assignment.gearItemId,
          performedByPersonId: actorPersonId,
          maintenanceType: GearMaintenanceType.INSPECTION,
          performedAt: now,
          conditionBefore: assignment.gearItem.conditionStatus,
          conditionAfter: conditionOnRecovery,
          notes: normalizeOptional(parsed.data.recoveryNotes ?? "") ?? `Flagged during event recovery for ${assignment.plan.event.title}.`,
        },
      });
    }

    const unrecoveredCount = assignment.plan.assignments.filter((entry) => !entry.recoveredAt && entry.id !== assignment.id).length;
    await db.eventGearPlan.update({
      where: { id: assignment.plan.id },
      data: {
        status: unrecoveredCount === 0 ? EventGearPlanStatus.COMPLETED : EventGearPlanStatus.RECOVERING,
        recoveryNotes: normalizeOptional(parsed.data.recoveryNotes ?? "") ?? undefined,
      },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId,
      action: "eventGearAssignment.recovered",
      entityType: "eventGearAssignment",
      entityId: updated.id,
      afterJson: JSON.stringify(updated),
      metadataJson: JSON.stringify({ eventId, planId: assignment.planId, gearItemId: assignment.gearItemId, checkoutId: latestCheckout?.id ?? null }),
    });

    return NextResponse.redirect(redirectTo(request.url, eventId, { recoverySaved: "1" }), 303);
  } catch (error) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, {
        recoveryError: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before recovering event gear."
            : "Unable to recover event gear right now. Please try again.",
      }),
      303,
    );
  }
}
