import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const schema = z.object({
  requirementId: z.string().trim().min(1, "Choose a requirement."),
  gearItemId: z.string().trim().min(1, "Choose a gear item."),
  notes: z.string().trim().max(4000).optional(),
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
    requirementId: getStringField(formData, "requirementId"),
    gearItemId: getStringField(formData, "gearItemId"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { assignmentError: scope.errorMessage ?? "Unable to assign gear right now." }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(redirectTo(request.url, eventId, { assignmentError: "No organization context is available yet." }), 303);
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { assignmentError: parsed.error.issues[0]?.message ?? "Please review the assignment details." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "eventGearAssignment.create",
      eventId,
    });

    const plan = await db.eventGearPlan.findFirst({
      where: { organizationId: scope.organizationId, eventId },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { assignmentError: "Create the event gear plan before assigning items." }),
        303,
      );
    }

    const requirement = await db.eventGearRequirement.findFirst({
      where: {
        id: parsed.data.requirementId,
        organizationId: scope.organizationId,
        planId: plan.id,
      },
      select: { id: true },
    });

    if (!requirement) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { assignmentError: "The selected requirement is not available for this event gear plan." }),
        303,
      );
    }

    const gearItem = await db.gearItem.findFirst({
      where: { id: parsed.data.gearItemId, organizationId: scope.organizationId },
      select: { id: true },
    });

    if (!gearItem) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { assignmentError: "The selected gear item is not available in this organization." }),
        303,
      );
    }

    const existing = await db.eventGearAssignment.findFirst({
      where: { organizationId: scope.organizationId, planId: plan.id, gearItemId: parsed.data.gearItemId },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { assignmentError: "That gear item is already assigned to this event gear plan." }),
        303,
      );
    }

    const actorPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!actorPersonId) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { assignmentError: "No organization person is available for assignment attribution yet." }),
        303,
      );
    }

    const assignment = await db.eventGearAssignment.create({
      data: {
        organizationId: scope.organizationId,
        planId: plan.id,
        requirementId: requirement.id,
        gearItemId: parsed.data.gearItemId,
        assignedByPersonId: actorPersonId,
        notes: normalizeOptional(parsed.data.notes ?? ""),
      },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId,
      action: "eventGearAssignment.created",
      entityType: "eventGearAssignment",
      entityId: assignment.id,
      afterJson: JSON.stringify(assignment),
      metadataJson: JSON.stringify({ eventId, planId: plan.id, requirementId: requirement.id, gearItemId: parsed.data.gearItemId }),
    });

    return NextResponse.redirect(redirectTo(request.url, eventId, { assignmentSaved: "1" }), 303);
  } catch (error) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, {
        assignmentError: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before assigning event gear."
            : "Unable to assign gear right now. Please try again.",
      }),
      303,
    );
  }
}
