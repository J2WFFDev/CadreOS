import { Prisma, StaffingAssignmentStatus, StaffingCoverageType } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  buildStaffingAssignmentAuditPayload,
  dateInputToNullableDate,
} from "@/lib/member-ops-staffing";
import { getOrganizationScope } from "@/lib/organization-context";
import {
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
        staffingError: scope.errorMessage ?? "Unable to update staffing assignment right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "No organization context is available yet." }),
      303,
    );
  }

  const statusRaw = getStringField(formData, "status").trim().toUpperCase();
  const endDate = getStringField(formData, "endDate").trim();
  const coverageTypes = formData
    .getAll("coverageTypes")
    .map((value) => `${value}`.trim().toUpperCase())
    .filter((value): value is StaffingCoverageType =>
      Object.values(StaffingCoverageType).includes(value as StaffingCoverageType),
    );

  if (!Object.values(StaffingAssignmentStatus).includes(statusRaw as StaffingAssignmentStatus)) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "Staffing assignment status is invalid." }),
      303,
    );
  }

  const parsedEndDate = dateInputToNullableDate(endDate);
  if (endDate && !parsedEndDate) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "End date must use YYYY-MM-DD." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "roleAssignment.create",
    });

    const existing = await db.staffingAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId: scope.organizationId,
        personId,
      },
      include: {
        staffingRole: { select: { id: true, name: true } },
        coverage: { select: { coverageType: true } },
      },
    });

    if (!existing) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, { staffingError: "Staffing assignment not found." }),
        303,
      );
    }

    const nextStatus = statusRaw as StaffingAssignmentStatus;

    if (parsedEndDate && existing.startDate && parsedEndDate < existing.startDate) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, { staffingError: "End date cannot be before start date." }),
        303,
      );
    }

    const updated = await db.staffingAssignment.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        endDate: parsedEndDate,
        coverage: {
          deleteMany: {},
          create: coverageTypes.map((coverageType) => ({
            organizationId: scope.organizationId!,
            coverageType,
          })),
        },
      },
      include: {
        coverage: { select: { coverageType: true } },
      },
    });

    let action = "staffing.assignment.updated";

    if (existing.status !== StaffingAssignmentStatus.ACTIVE && nextStatus === StaffingAssignmentStatus.ACTIVE) {
      action = "staffing.assignment.activated";
    } else if (!existing.endDate && Boolean(updated.endDate)) {
      action = "staffing.assignment.ended";
    }

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action,
      entityType: "staffingAssignment",
      entityId: updated.id,
      beforeJson: JSON.stringify(
        buildStaffingAssignmentAuditPayload({
          assignmentId: existing.id,
          personId: existing.personId,
          staffingRoleId: existing.staffingRoleId,
          staffingRoleName: existing.staffingRole.name,
          status: existing.status,
          programId: existing.programId,
          teamId: existing.teamId,
          startDate: existing.startDate,
          endDate: existing.endDate,
          coverage: existing.coverage.map((item) => item.coverageType),
        }),
      ),
      afterJson: JSON.stringify(
        buildStaffingAssignmentAuditPayload({
          assignmentId: updated.id,
          personId: updated.personId,
          staffingRoleId: updated.staffingRoleId,
          staffingRoleName: existing.staffingRole.name,
          status: updated.status,
          programId: updated.programId,
          teamId: updated.teamId,
          startDate: updated.startDate,
          endDate: updated.endDate,
          coverage: updated.coverage.map((item) => item.coverageType),
        }),
      ),
      metadataJson: JSON.stringify({
        personId,
        staffingRoleName: existing.staffingRole.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingSuccess: `Updated ${existing.staffingRole.name}.` }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
        ? "Staffing assignment could not be found."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before updating staffing assignments."
            : "Unable to update staffing assignment right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: message }),
      303,
    );
  }
}
