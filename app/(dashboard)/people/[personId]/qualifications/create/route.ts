import { Prisma, QualificationAssignmentStatus } from "@prisma/client";
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
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        qualificationError: scope.errorMessage ?? "Unable to assign qualification right now.",
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

  const qualificationId = getStringField(formData, "qualificationId");
  const earnedDate = getStringField(formData, "earnedDate");
  const expirationDate = getStringField(formData, "expirationDate");
  const statusRaw = getStringField(formData, "status");
  const notes = getStringField(formData, "notes").trim();

  if (!qualificationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { qualificationError: "Select a qualification to assign." }),
      303,
    );
  }

  if (!Object.values(QualificationAssignmentStatus).includes(statusRaw as QualificationAssignmentStatus)) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { qualificationError: "Qualification status is invalid." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "personQualification.create",
    });

    const [person, qualification] = await Promise.all([
      db.person.findFirst({
        where: { id: personId, organizationId: scope.organizationId },
        select: { id: true },
      }),
      db.qualificationDefinition.findFirst({
        where: { id: qualificationId, organizationId: scope.organizationId },
        select: { id: true, name: true },
      }),
    ]);

    if (!person || !qualification) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, {
          qualificationError: "Person or qualification could not be found in this organization.",
        }),
        303,
      );
    }

    const assignment = await db.personQualification.create({
      data: {
        organizationId: scope.organizationId,
        personId: person.id,
        qualificationId: qualification.id,
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

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action: "qualification.assignment.granted",
      entityType: "personQualification",
      entityId: assignment.id,
      afterJson: JSON.stringify({
        qualificationId: qualification.id,
        qualificationName: qualification.name,
        status: assignment.status,
        resolvedStatus: resolveQualificationAssignmentStatus(assignment.status, assignment.expirationDate),
      }),
      metadataJson: JSON.stringify({
        personId,
        qualificationName: qualification.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        qualificationSuccess: `Assigned ${qualification.name}.`,
      }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "That qualification is already assigned to this member."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before assigning qualifications."
            : "Unable to assign qualification right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { qualificationError: message }),
      303,
    );
  }
}
