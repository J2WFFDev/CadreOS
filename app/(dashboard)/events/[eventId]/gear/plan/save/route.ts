import { EventGearPlanStatus } from "@/lib/prisma-client";
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
  status: z.nativeEnum(EventGearPlanStatus),
  stagingLocationId: z.string().trim().optional(),
  recoveryLocationId: z.string().trim().optional(),
  deploymentLocationText: z.string().trim().max(120).optional(),
  checklistNotes: z.string().trim().max(4000).optional(),
  stagingNotes: z.string().trim().max(4000).optional(),
  recoveryNotes: z.string().trim().max(4000).optional(),
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
  url.hash = "plan-settings";
  return url;
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    status: getStringField(formData, "status"),
    stagingLocationId: getStringField(formData, "stagingLocationId"),
    recoveryLocationId: getStringField(formData, "recoveryLocationId"),
    deploymentLocationText: getStringField(formData, "deploymentLocationText"),
    checklistNotes: getStringField(formData, "checklistNotes"),
    stagingNotes: getStringField(formData, "stagingNotes"),
    recoveryNotes: getStringField(formData, "recoveryNotes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { planError: scope.errorMessage ?? "Unable to save event gear plan right now." }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(redirectTo(request.url, eventId, { planError: "No organization context is available yet." }), 303);
  }
  const organizationId = scope.organizationId;

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { planError: parsed.error.issues[0]?.message ?? "Please review the plan details." }),
      303,
    );
  }

  try {
    const existingPlan = await db.eventGearPlan.findFirst({
      where: { organizationId: organizationId, eventId },
      select: { id: true, preparedAt: true },
    });

    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: existingPlan ? "eventGearPlan.update" : "eventGearPlan.create",
      eventId,
    });

    const event = await db.event.findFirst({
      where: { id: eventId, organizationId: organizationId },
      select: { id: true, title: true },
    });

    if (!event) {
      return NextResponse.redirect(redirectTo(request.url, eventId, { planError: "Event not found in this organization." }), 303);
    }

    for (const [field, locationId] of [
      ["staging location", normalizeOptional(parsed.data.stagingLocationId ?? "")],
      ["recovery location", normalizeOptional(parsed.data.recoveryLocationId ?? "")],
    ] as const) {
      if (!locationId) continue;
      const location = await db.inventoryLocation.findFirst({
        where: { id: locationId, organizationId: organizationId },
        select: { id: true },
      });
      if (!location) {
        return NextResponse.redirect(
          redirectTo(request.url, eventId, { planError: `The selected ${field} is not available in this organization.` }),
          303,
        );
      }
    }

    const actorPersonId = await resolveActorPersonId({
      organizationId: organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!actorPersonId) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { planError: "No organization person is available for plan attribution yet." }),
        303,
      );
    }

    const now = new Date();
    const status = parsed.data.status;
    const saved = await db.eventGearPlan.upsert({
      where: { eventId },
      create: {
        organizationId: organizationId,
        eventId,
        createdByPersonId: actorPersonId,
        status,
        stagingLocationId: normalizeOptional(parsed.data.stagingLocationId ?? ""),
        recoveryLocationId: normalizeOptional(parsed.data.recoveryLocationId ?? ""),
        deploymentLocationText: normalizeOptional(parsed.data.deploymentLocationText ?? ""),
        checklistNotes: normalizeOptional(parsed.data.checklistNotes ?? ""),
        stagingNotes: normalizeOptional(parsed.data.stagingNotes ?? ""),
        recoveryNotes: normalizeOptional(parsed.data.recoveryNotes ?? ""),
        preparedByPersonId: status === "DRAFT" ? null : actorPersonId,
        preparedAt: status === "DRAFT" ? null : now,
        readinessCheckedAt: status === "DRAFT" ? null : now,
      },
      update: {
        status,
        stagingLocationId: normalizeOptional(parsed.data.stagingLocationId ?? ""),
        recoveryLocationId: normalizeOptional(parsed.data.recoveryLocationId ?? ""),
        deploymentLocationText: normalizeOptional(parsed.data.deploymentLocationText ?? ""),
        checklistNotes: normalizeOptional(parsed.data.checklistNotes ?? ""),
        stagingNotes: normalizeOptional(parsed.data.stagingNotes ?? ""),
        recoveryNotes: normalizeOptional(parsed.data.recoveryNotes ?? ""),
        preparedByPersonId: status === "DRAFT" ? null : actorPersonId,
        preparedAt: status === "DRAFT" ? null : existingPlan?.preparedAt ?? now,
        readinessCheckedAt: status === "DRAFT" ? null : now,
      },
    });

    await writeAuditEvent({
      organizationId: organizationId,
      actorPersonId,
      action: existingPlan ? "eventGearPlan.updated" : "eventGearPlan.created",
      entityType: "eventGearPlan",
      entityId: saved.id,
      afterJson: JSON.stringify(saved),
      metadataJson: JSON.stringify({ eventId: event.id, eventTitle: event.title }),
    });

    return NextResponse.redirect(redirectTo(request.url, eventId, { planSaved: "1" }), 303);
  } catch (error) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, {
        planError: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before saving event gear plans."
            : "Unable to save event gear plan right now. Please try again.",
      }),
      303,
    );
  }
}
