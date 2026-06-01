import { MemberLifecycleStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  memberLifecycleActivateSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const ACTIVATABLE_STATUSES = new Set<MemberLifecycleStatus>([
  MemberLifecycleStatus.PROSPECT,
  MemberLifecycleStatus.APPLICANT,
  MemberLifecycleStatus.INACTIVE,
  MemberLifecycleStatus.ALUMNI,
  MemberLifecycleStatus.FORMER,
  MemberLifecycleStatus.ARCHIVED,
]);

function buildErrorRedirectUrl(requestUrl: string, personId: string, error: string) {
  const url = new URL(`/people/${personId}`, requestUrl);

  url.searchParams.set("activateError", error);

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
    confirm: getStringField(formData, "confirm"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, scope.errorMessage ?? "Unable to activate member right now."),
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

  const parsed = memberLifecycleActivateSchema.safeParse(values);

  if (!parsed.success) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "Activation confirmation is required."),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "person.activate",
    });

    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId: organizationId,
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

    if (!ACTIVATABLE_STATUSES.has(person.lifecycleStatus)) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(
          request.url,
          personId,
          `This person cannot be activated from their current status (${person.lifecycleStatus}). Only Prospect, Applicant, Inactive, Alumni, Former, or Archived members can be activated.`,
        ),
        303,
      );
    }

    const updatedPerson = await db.person.update({
      where: {
        id: personId,
        organizationId: organizationId,
      },
      data: {
        lifecycleStatus: MemberLifecycleStatus.ACTIVE,
        lifecycleStatusChangedAt: new Date(),
        lifecycleStatusReason: "Activated member from lifecycle workflow.",
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
      action: "person.lifecycle.activate",
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
    });

    return NextResponse.redirect(new URL(`/people/${personId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        personId,
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before activating members."
            : "Unable to activate member right now. Please try again.",
      ),
      303,
    );
  }
}
