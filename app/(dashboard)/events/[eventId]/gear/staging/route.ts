import { EventGearPlanStatus, InventoryMovementType } from "@/lib/prisma-client";
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
  stagedToLocationId: z.string().trim().optional(),
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
  url.hash = "requirements";
  return url;
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    eventGearAssignmentId: getStringField(formData, "eventGearAssignmentId"),
    stagedToLocationId: getStringField(formData, "stagedToLocationId"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { stagingError: scope.errorMessage ?? "Unable to stage gear right now." }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(redirectTo(request.url, eventId, { stagingError: "No organization context is available yet." }), 303);
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { stagingError: parsed.error.issues[0]?.message ?? "Please review the staging details." }),
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
        stagedAt: true,
        gearItem: { select: { locationId: true } },
        plan: { select: { id: true, status: true, stagingLocationId: true, event: { select: { id: true, title: true } } } },
      },
    });

    if (!assignment) {
      return NextResponse.redirect(redirectTo(request.url, eventId, { stagingError: "Event gear assignment not found." }), 303);
    }

    const stagedToLocationId = normalizeOptional(parsed.data.stagedToLocationId ?? "") ?? assignment.plan.stagingLocationId;
    if (stagedToLocationId) {
      const location = await db.inventoryLocation.findFirst({
        where: { id: stagedToLocationId, organizationId: scope.organizationId },
        select: { id: true },
      });
      if (!location) {
        return NextResponse.redirect(
          redirectTo(request.url, eventId, { stagingError: "The selected staging location is not available in this organization." }),
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
        redirectTo(request.url, eventId, { stagingError: "No organization person is available for staging attribution yet." }),
        303,
      );
    }

    const now = new Date();
    const updated = await db.eventGearAssignment.update({
      where: { id: assignment.id },
      data: {
        stagedAt: now,
        stagedByPersonId: actorPersonId,
        stagedFromLocationId: assignment.gearItem.locationId,
        stagedToLocationId: stagedToLocationId ?? null,
      },
    });

    if (stagedToLocationId || assignment.gearItem.locationId) {
      await recordInventoryMovement({
        organizationId: scope.organizationId,
        gearItemId: assignment.gearItemId,
        movementType: InventoryMovementType.MOVED_TO_LOCATION,
        actorPersonId,
        fromLocationId: assignment.gearItem.locationId,
        toLocationId: stagedToLocationId,
        relatedRecordType: "EVENT_GEAR_PLAN",
        relatedRecordId: assignment.planId,
        notes: `Staged for event ${assignment.plan.event.title}`,
        updateLocationId: stagedToLocationId ?? undefined,
      });
    }

    if (assignment.plan.status === EventGearPlanStatus.DRAFT || assignment.plan.status === EventGearPlanStatus.READY_TO_STAGE) {
      await db.eventGearPlan.update({
        where: { id: assignment.plan.id },
        data: {
          status: EventGearPlanStatus.STAGED,
          preparedByPersonId: actorPersonId,
          preparedAt: now,
          readinessCheckedAt: now,
        },
      });
    }

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId,
      action: "eventGearAssignment.staged",
      entityType: "eventGearAssignment",
      entityId: updated.id,
      afterJson: JSON.stringify(updated),
      metadataJson: JSON.stringify({ eventId, planId: assignment.planId, gearItemId: assignment.gearItemId }),
    });

    return NextResponse.redirect(redirectTo(request.url, eventId, { stagingSaved: "1" }), 303);
  } catch (error) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, {
        stagingError: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before staging event gear."
            : "Unable to stage gear right now. Please try again.",
      }),
      303,
    );
  }
}
