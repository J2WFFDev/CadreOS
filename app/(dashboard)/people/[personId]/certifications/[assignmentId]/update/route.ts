import { CertificationVerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveCertificationVerificationStatus } from "@/lib/member-ops-qualifications";
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
        certificationError: scope.errorMessage ?? "Unable to update certification right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { certificationError: "No organization context is available yet." }),
      303,
    );
  }

  const earnedDate = getStringField(formData, "earnedDate");
  const expirationDate = getStringField(formData, "expirationDate");
  const verificationStatusRaw = getStringField(formData, "verificationStatus");
  const notes = getStringField(formData, "notes").trim();

  if (
    !Object.values(CertificationVerificationStatus).includes(
      verificationStatusRaw as CertificationVerificationStatus,
    )
  ) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { certificationError: "Certification verification status is invalid." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "personCertification.update",
    });

    const existing = await db.personCertification.findFirst({
      where: {
        id: assignmentId,
        organizationId: scope.organizationId,
        personId,
      },
      include: {
        certification: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, { certificationError: "Certification assignment not found." }),
        303,
      );
    }

    const updated = await db.personCertification.update({
      where: { id: existing.id },
      data: {
        earnedDate: earnedDate ? dateInputToUtcDate(earnedDate) : null,
        expirationDate: expirationDate ? dateInputToUtcDate(expirationDate) : null,
        verificationStatus: verificationStatusRaw as CertificationVerificationStatus,
        notes: notes || null,
      },
      select: {
        id: true,
        verificationStatus: true,
        expirationDate: true,
      },
    });

    const resolvedStatus = resolveCertificationVerificationStatus(
      updated.verificationStatus,
      updated.expirationDate,
    );

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action:
        resolvedStatus === CertificationVerificationStatus.EXPIRED
          ? "certification.assignment.expired"
          : "certification.assignment.update",
      entityType: "personCertification",
      entityId: updated.id,
      beforeJson: JSON.stringify({
        certificationName: existing.certification.name,
        verificationStatus: existing.verificationStatus,
        expirationDate: existing.expirationDate?.toISOString() ?? null,
        notes: existing.notes,
      }),
      afterJson: JSON.stringify({
        certificationName: existing.certification.name,
        verificationStatus: updated.verificationStatus,
        resolvedStatus,
        expirationDate: updated.expirationDate?.toISOString() ?? null,
        notes: notes || null,
      }),
      metadataJson: JSON.stringify({
        personId,
        certificationName: existing.certification.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        certificationSuccess: `Updated ${existing.certification.name}.`,
      }),
      303,
    );
  } catch (error) {
    const message = isPermissionDeniedError(error)
      ? error.message
      : isSchemaUnavailableError(error)
        ? "Database schema is not available yet. Run database setup before updating certifications."
        : "Unable to update certification right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { certificationError: message }),
      303,
    );
  }
}
