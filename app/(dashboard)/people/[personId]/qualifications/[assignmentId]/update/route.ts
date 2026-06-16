import { QualificationAssignmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveQualificationAssignmentStatus } from "@/lib/member-ops-qualifications";
import {
  dateInputToUtcDate,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, personId: string, params: Record<string, string>) {
  const url = new URL(`/people/${personId}`, requestUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string; assignmentId: string }> },
) {
  const { personId, assignmentId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        qualificationError: scope.errorMessage ?? "Unable to update qualification right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { qualificationError: "No organization context is available yet." }),
      303,
    );
  }

  const earnedDate = getStringField(formData, "earnedDate");
  const expirationDate = getStringField(formData, "expirationDate");
  const statusRaw = getStringField(formData, "status");
  const notes = getStringField(formData, "notes").trim();

  if (!Object.values(QualificationAssignmentStatus).includes(statusRaw as QualificationAssignmentStatus)) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { qualificationError: "Qualification status is invalid." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "personQualification.update",
      personId,
    });

    const existing = await db.personQualification.findFirst({
      where: {
        id: assignmentId,
        organizationId: scope.organizationId,
        personId,
      },
      include: {
        qualification: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, { qualificationError: "Qualification assignment not found." }),
        303,
      );
    }

    const updated = await db.personQualification.update({
      where: { id: existing.id },
      data: {
        earnedDate: earnedDate ? dateInputToUtcDate(earnedDate) : null,
        expirationDate: expirationDate ? dateInputToUtcDate(expirationDate) : null,
        status: statusRaw as QualificationAssignmentStatus,
        notes: notes || null,
      },
      select: {
        id: true,
        status: true,
        expirationDate: true,
      },
    });

    const resolvedStatus = resolveQualificationAssignmentStatus(updated.status, updated.expirationDate);

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action:
        updated.status === QualificationAssignmentStatus.SUSPENDED
          ? "qualification.assignment.revoked"
          : "qualification.assignment.update",
      entityType: "personQualification",
      entityId: updated.id,
      beforeJson: JSON.stringify({
        qualificationName: existing.qualification.name,
        status: existing.status,
        expirationDate: existing.expirationDate?.toISOString() ?? null,
        notes: existing.notes,
      }),
      afterJson: JSON.stringify({
        qualificationName: existing.qualification.name,
        status: updated.status,
        resolvedStatus,
        expirationDate: updated.expirationDate?.toISOString() ?? null,
        notes: notes || null,
      }),
      metadataJson: JSON.stringify({
        personId,
        qualificationName: existing.qualification.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        qualificationSuccess: `Updated ${existing.qualification.name}.`,
      }),
      303,
    );
  } catch (error) {
    const message = isPermissionDeniedError(error)
      ? error.message
      : isSchemaUnavailableError(error)
        ? "Database schema is not available yet. Run database setup before updating qualifications."
        : "Unable to update qualification right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { qualificationError: message }),
      303,
    );
  }
}
