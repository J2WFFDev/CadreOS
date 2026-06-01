import { EligibilityTargetType } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, params: Record<string, string>) {
  const url = new URL("/people/qualifications", requestUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, {
        error: scope.errorMessage ?? "Unable to create eligibility right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "No organization context is available yet." }),
      303,
    );
  }

  const name = getStringField(formData, "name").trim();
  const description = getStringField(formData, "description").trim();
  const targetTypeRaw = getStringField(formData, "targetType");
  const targetLabel = getStringField(formData, "targetLabel").trim();
  const programId = getStringField(formData, "programId") || null;
  const teamId = getStringField(formData, "teamId") || null;
  const qualificationIds = formData
    .getAll("qualificationIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const certificationIds = formData
    .getAll("certificationIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (!name) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "Eligibility name is required." }),
      303,
    );
  }

  if (!Object.values(EligibilityTargetType).includes(targetTypeRaw as EligibilityTargetType)) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "Eligibility target type is invalid." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "eligibilityDefinition.create",
      programId,
      teamId,
    });

    const [program, team, qualifications, certifications] = await Promise.all([
      programId
        ? db.program.findFirst({
            where: { id: programId, organizationId: scope.organizationId },
            select: { id: true },
          })
        : Promise.resolve(null),
      teamId
        ? db.team.findFirst({
            where: { id: teamId, organizationId: scope.organizationId },
            select: { id: true, programId: true },
          })
        : Promise.resolve(null),
      qualificationIds.length === 0
        ? Promise.resolve([])
        : db.qualificationDefinition.findMany({
            where: { organizationId: scope.organizationId, id: { in: qualificationIds } },
            select: { id: true },
          }),
      certificationIds.length === 0
        ? Promise.resolve([])
        : db.certificationDefinition.findMany({
            where: { organizationId: scope.organizationId, id: { in: certificationIds } },
            select: { id: true },
          }),
    ]);

    if (programId && !program) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, { error: "Selected program is invalid." }),
        303,
      );
    }

    if (teamId && !team) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, { error: "Selected team is invalid." }),
        303,
      );
    }

    if (team && programId && programId !== team.programId) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, { error: "Selected team does not belong to the selected program." }),
        303,
      );
    }

    if (qualifications.length !== qualificationIds.length || certifications.length !== certificationIds.length) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, {
          error: "Eligibility requirements must use qualifications and certifications from this organization.",
        }),
        303,
      );
    }

    const eligibility = await db.$transaction(async (transaction) => {
      const created = await transaction.eligibilityDefinition.create({
        data: {
          organizationId: scope.organizationId!,
          name,
          description: description || null,
          targetType: targetTypeRaw as EligibilityTargetType,
          active: formData.has("active"),
          programId,
          teamId,
          targetLabel: targetLabel || null,
        },
        select: { id: true, name: true, targetType: true },
      });

      if (qualificationIds.length > 0) {
        await transaction.eligibilityRequiredQualification.createMany({
          data: qualificationIds.map((qualificationId) => ({
            organizationId: scope.organizationId!,
            eligibilityId: created.id,
            qualificationId,
          })),
        });
      }

      if (certificationIds.length > 0) {
        await transaction.eligibilityRequiredCertification.createMany({
          data: certificationIds.map((certificationId) => ({
            organizationId: scope.organizationId!,
            eligibilityId: created.id,
            certificationId,
          })),
        });
      }

      return created;
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action: "eligibility.definition.create",
      entityType: "eligibilityDefinition",
      entityId: eligibility.id,
      afterJson: JSON.stringify({
        ...eligibility,
        qualificationIds,
        certificationIds,
      }),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, { success: `Created eligibility rule ${eligibility.name}.` }),
      303,
    );
  } catch (error) {
    const message = isPermissionDeniedError(error)
      ? error.message
      : isSchemaUnavailableError(error)
        ? "Database schema is not available yet. Run database setup before creating eligibility rules."
        : "Unable to create eligibility right now. Please try again.";

    return NextResponse.redirect(buildRedirectUrl(request.url, { error: message }), 303);
  }
}
