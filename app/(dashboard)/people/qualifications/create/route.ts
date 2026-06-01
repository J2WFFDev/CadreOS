import { Prisma } from "@prisma/client";
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

  const name = getStringField(formData, "name").trim();
  const description = getStringField(formData, "description").trim();
  const qualificationType = getStringField(formData, "qualificationType").trim();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, {
        error: scope.errorMessage ?? "Unable to create qualification right now.",
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

  if (!name || !qualificationType) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "Qualification name and type are required." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "qualificationDefinition.create",
    });

    const qualification = await db.qualificationDefinition.create({
      data: {
        organizationId: scope.organizationId,
        name,
        description: description || null,
        qualificationType,
        active: formData.has("active"),
        supportsTeamParticipation: formData.has("supportsTeamParticipation"),
        supportsProgramParticipation: formData.has("supportsProgramParticipation"),
        supportsEquipmentEligibility: formData.has("supportsEquipmentEligibility"),
      },
      select: {
        id: true,
        name: true,
        qualificationType: true,
        active: true,
      },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action: "qualification.definition.create",
      entityType: "qualificationDefinition",
      entityId: qualification.id,
      afterJson: JSON.stringify(qualification),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, { success: `Created qualification ${qualification.name}.` }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "That qualification already exists."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating qualifications."
            : "Unable to create qualification right now. Please try again.";

    return NextResponse.redirect(buildRedirectUrl(request.url, { error: message }), 303);
  }
}
