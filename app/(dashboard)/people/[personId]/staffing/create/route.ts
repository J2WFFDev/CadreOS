import { Prisma, StaffingAssignmentStatus, StaffingCoverageType } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  buildStaffingAssignmentAuditPayload,
  dateInputToNullableDate,
  ensureStaffingRoleFoundation,
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
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        staffingError: scope.errorMessage ?? "Unable to create staffing assignment right now.",
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

  const staffingRoleId = getStringField(formData, "staffingRoleId").trim();
  const programId = getStringField(formData, "programId").trim();
  const teamId = getStringField(formData, "teamId").trim();
  const startDate = getStringField(formData, "startDate").trim();
  const endDate = getStringField(formData, "endDate").trim();
  const statusRaw = getStringField(formData, "status").trim().toUpperCase();
  const coverageTypes = formData
    .getAll("coverageTypes")
    .map((value) => `${value}`.trim().toUpperCase())
    .filter((value): value is StaffingCoverageType =>
      Object.values(StaffingCoverageType).includes(value as StaffingCoverageType),
    );

  if (!staffingRoleId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "Select a staffing role." }),
      303,
    );
  }

  if (!Object.values(StaffingAssignmentStatus).includes(statusRaw as StaffingAssignmentStatus)) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "Staffing assignment status is invalid." }),
      303,
    );
  }

  const parsedStartDate = dateInputToNullableDate(startDate);
  const parsedEndDate = dateInputToNullableDate(endDate);

  if (startDate && !parsedStartDate) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "Start date must use YYYY-MM-DD." }),
      303,
    );
  }

  if (endDate && !parsedEndDate) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "End date must use YYYY-MM-DD." }),
      303,
    );
  }

  if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: "End date cannot be before start date." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "roleAssignment.create",
      programId: programId || null,
      teamId: teamId || null,
    });

    await ensureStaffingRoleFoundation(scope.organizationId);

    const [person, staffingRole] = await Promise.all([
      db.person.findFirst({
        where: { id: personId, organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
      }),
      db.staffingRole.findFirst({
        where: { id: staffingRoleId, organizationId: scope.organizationId, active: true },
        select: { id: true, name: true },
      }),
    ]);

    if (!person || !staffingRole) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, personId, {
          staffingError: "Person or staffing role could not be found in this organization.",
        }),
        303,
      );
    }

    let normalizedProgramId: string | null = programId || null;
    let normalizedTeamId: string | null = teamId || null;

    if (normalizedTeamId) {
      const team = await db.team.findFirst({
        where: { id: normalizedTeamId, organizationId: scope.organizationId },
        select: { id: true, programId: true },
      });

      if (!team) {
        return NextResponse.redirect(
          buildRedirectUrl(request.url, personId, {
            staffingError: "Selected team is invalid for this organization.",
          }),
          303,
        );
      }

      normalizedProgramId = team.programId;
      normalizedTeamId = team.id;
    } else if (normalizedProgramId) {
      const program = await db.program.findFirst({
        where: { id: normalizedProgramId, organizationId: scope.organizationId },
        select: { id: true },
      });

      if (!program) {
        return NextResponse.redirect(
          buildRedirectUrl(request.url, personId, {
            staffingError: "Selected program is invalid for this organization.",
          }),
          303,
        );
      }

      normalizedProgramId = program.id;
    }

    const assignment = await db.staffingAssignment.create({
      data: {
        organizationId: scope.organizationId,
        personId: person.id,
        staffingRoleId: staffingRole.id,
        programId: normalizedProgramId,
        teamId: normalizedTeamId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        status: statusRaw as StaffingAssignmentStatus,
        coverage: coverageTypes.length
          ? {
              create: coverageTypes.map((coverageType) => ({
                organizationId: scope.organizationId,
                coverageType,
              })),
            }
          : undefined,
      },
      include: {
        coverage: { select: { coverageType: true } },
      },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action: "staffing.assignment.assigned",
      entityType: "staffingAssignment",
      entityId: assignment.id,
      afterJson: JSON.stringify(
        buildStaffingAssignmentAuditPayload({
          assignmentId: assignment.id,
          personId: assignment.personId,
          staffingRoleId: assignment.staffingRoleId,
          staffingRoleName: staffingRole.name,
          status: assignment.status,
          programId: assignment.programId,
          teamId: assignment.teamId,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          coverage: assignment.coverage.map((item) => item.coverageType),
        }),
      ),
      metadataJson: JSON.stringify({
        personId: person.id,
        personName: `${person.firstName} ${person.lastName}`,
        staffingRoleName: staffingRole.name,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, {
        staffingSuccess: `Assigned ${staffingRole.name}.`,
      }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "That staffing assignment already exists."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before assigning staffing roles."
            : "Unable to assign staffing role right now. Please try again.";

    return NextResponse.redirect(
      buildRedirectUrl(request.url, personId, { staffingError: message }),
      303,
    );
  }
}
