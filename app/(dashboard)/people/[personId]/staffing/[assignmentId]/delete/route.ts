import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { buildStaffingAssignmentAuditPayload } from "@/lib/member-ops-staffing";
import { getOrganizationScope } from "@/lib/organization-context";
import {
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

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        staffingError: scope.errorMessage ?? "Unable to remove staffing assignment right now.",
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

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "roleAssignment.delete",
    });

    const existing = await db.staffingAssignment.findFirst({
      where: {
        id: assignmentId,
        personId,
        organizationId: scope.organizationId,
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

    await db.staffingAssignment.delete({
      where: { id: existing.id },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action: "staffing.assignment.removed",
      entityType: "staffingAssignment",
      entityId: existing.id,
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
      metadataJson: JSON.stringify({
        personId,
        staffingRoleName: existing.staffingRole.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        staffingSuccess: `Removed ${existing.staffingRole.name}.`,
      }),
      303,
    );
  } catch (error) {
    const message = isPermissionDeniedError(error)
      ? error.message
      : isSchemaUnavailableError(error)
        ? "Database schema is not available yet. Run database setup before removing staffing assignments."
        : "Unable to remove staffing assignment right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: message }),
      303,
    );
  }
}
