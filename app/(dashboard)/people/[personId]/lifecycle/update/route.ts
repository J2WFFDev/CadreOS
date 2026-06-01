import { MemberLifecycleStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const lifecycleStatusUpdateSchema = z.object({
  lifecycleStatus: z.nativeEnum(MemberLifecycleStatus, {
    message: "Lifecycle status must use an existing status value.",
  }),
  lifecycleReason: z
    .string()
    .trim()
    .max(300, "Lifecycle reason must be 300 characters or less.")
    .optional()
    .transform((value) => value || null),
});

function buildErrorRedirectUrl(requestUrl: string, personId: string, error: string) {
  const url = new URL(`/people/${personId}`, requestUrl);
  url.searchParams.set("lifecycleError", error);
  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const values = {
    lifecycleStatus: getStringField(formData, "lifecycleStatus"),
    lifecycleReason: getStringField(formData, "lifecycleReason"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, scope.errorMessage ?? "Unable to update lifecycle status right now."),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "No organization context is available yet."),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = lifecycleStatusUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "Select a valid lifecycle status."),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId,
      action: "person.update",
    });

    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId,
      },
      select: {
        id: true,
        lifecycleStatus: true,
        lifecycleStatusReason: true,
      },
    });

    if (!person) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, "Person not found in the selected organization."),
        303,
      );
    }

    const updatedPerson = await db.person.update({
      where: {
        id: person.id,
        organizationId,
      },
      data: {
        lifecycleStatus: parsed.data.lifecycleStatus,
        lifecycleStatusChangedAt: new Date(),
        lifecycleStatusReason: parsed.data.lifecycleReason,
      },
      select: {
        lifecycleStatus: true,
        lifecycleStatusChangedAt: true,
        lifecycleStatusReason: true,
      },
    });

    await writeAuditEvent({
      organizationId,
      actorPersonId: scope.auth.personId,
      action: "person.lifecycle.update",
      entityType: "person",
      entityId: person.id,
      beforeJson: JSON.stringify({
        lifecycleStatus: person.lifecycleStatus,
        lifecycleStatusReason: person.lifecycleStatusReason,
      }),
      afterJson: JSON.stringify({
        lifecycleStatus: updatedPerson.lifecycleStatus,
        lifecycleStatusChangedAt: updatedPerson.lifecycleStatusChangedAt.toISOString(),
        lifecycleStatusReason: updatedPerson.lifecycleStatusReason,
      }),
      metadataJson: JSON.stringify({
        transitionType: "manual_update",
      }),
    });

    return NextResponse.redirect(new URL(`/people/${personId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, "Person not found in the selected organization."),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        personId,
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before updating lifecycle status."
            : "Unable to update lifecycle status right now. Please try again.",
      ),
      303,
    );
  }
}
