import { CertificationVerificationStatus, Prisma } from "@prisma/client";
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
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        certificationError: scope.errorMessage ?? "Unable to assign certification right now.",
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

  const certificationId = getStringField(formData, "certificationId");
  const earnedDate = getStringField(formData, "earnedDate");
  const expirationDate = getStringField(formData, "expirationDate");
  const verificationStatusRaw = getStringField(formData, "verificationStatus");
  const notes = getStringField(formData, "notes").trim();

  if (!certificationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { certificationError: "Select a certification to assign." }),
      303,
    );
  }

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
      action: "personCertification.create",
      personId,
    });

    const [person, certification] = await Promise.all([
      db.person.findFirst({
        where: { id: personId, organizationId: scope.organizationId },
        select: { id: true },
      }),
      db.certificationDefinition.findFirst({
        where: { id: certificationId, organizationId: scope.organizationId },
        select: { id: true, name: true },
      }),
    ]);

    if (!person || !certification) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, {
          certificationError: "Person or certification could not be found in this organization.",
        }),
        303,
      );
    }

    const assignment = await db.personCertification.create({
      data: {
        organizationId: scope.organizationId,
        personId: person.id,
        certificationId: certification.id,
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
      assignment.verificationStatus,
      assignment.expirationDate,
    );

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action:
        resolvedStatus === CertificationVerificationStatus.EXPIRED
          ? "certification.assignment.expired"
          : "certification.assignment.added",
      entityType: "personCertification",
      entityId: assignment.id,
      afterJson: JSON.stringify({
        certificationId: certification.id,
        certificationName: certification.name,
        verificationStatus: assignment.verificationStatus,
        resolvedStatus,
      }),
      metadataJson: JSON.stringify({
        personId,
        certificationName: certification.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        certificationSuccess: `Assigned ${certification.name}.`,
      }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "That certification is already assigned to this member."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before assigning certifications."
            : "Unable to assign certification right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { certificationError: message }),
      303,
    );
  }
}
