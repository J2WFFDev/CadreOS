import { EventGearRequirementType } from "@/lib/prisma-client";
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
  label: z.string().trim().min(1, "Requirement label is required.").max(120),
  requirementType: z.nativeEnum(EventGearRequirementType),
  gearCategoryId: z.string().trim().optional(),
  quantityNeeded: z.coerce.number().int().min(1).max(999),
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
    label: getStringField(formData, "label"),
    requirementType: getStringField(formData, "requirementType"),
    gearCategoryId: getStringField(formData, "gearCategoryId"),
    quantityNeeded: getStringField(formData, "quantityNeeded"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, { requirementError: scope.errorMessage ?? "Unable to add the requirement right now." }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(redirectTo(request.url, eventId, { requirementError: "No organization context is available yet." }), 303);
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, {
        requirementError: parsed.error.issues[0]?.message ?? "Please review the requirement details.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "eventGearRequirement.create",
      eventId,
    });

    const plan = await db.eventGearPlan.findFirst({
      where: { organizationId: scope.organizationId, eventId },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.redirect(
        redirectTo(request.url, eventId, { requirementError: "Create the event gear plan before adding requirements." }),
        303,
      );
    }

    const gearCategoryId = normalizeOptional(parsed.data.gearCategoryId ?? "");
    if (gearCategoryId) {
      const category = await db.gearCategory.findFirst({
        where: { id: gearCategoryId, organizationId: scope.organizationId },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.redirect(
          redirectTo(request.url, eventId, { requirementError: "The selected category is not available in this organization." }),
          303,
        );
      }
    }

    const actorPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    const requirement = await db.eventGearRequirement.create({
      data: {
        organizationId: scope.organizationId,
        planId: plan.id,
        label: parsed.data.label,
        requirementType: parsed.data.requirementType,
        gearCategoryId,
        quantityNeeded: parsed.data.quantityNeeded,
        notes: normalizeOptional(parsed.data.notes ?? ""),
      },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId,
      action: "eventGearRequirement.created",
      entityType: "eventGearRequirement",
      entityId: requirement.id,
      afterJson: JSON.stringify(requirement),
      metadataJson: JSON.stringify({ eventId, planId: plan.id }),
    });

    return NextResponse.redirect(redirectTo(request.url, eventId, { requirementSaved: "1" }), 303);
  } catch (error) {
    return NextResponse.redirect(
      redirectTo(request.url, eventId, {
        requirementError: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before adding requirements."
            : "Unable to add the requirement right now. Please try again.",
      }),
      303,
    );
  }
}
