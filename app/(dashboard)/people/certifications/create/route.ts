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
  const issuingOrganization = getStringField(formData, "issuingOrganization").trim();

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, {
        error: scope.errorMessage ?? "Unable to create certification right now.",
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

  if (!name) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, { error: "Certification name is required." }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "certificationDefinition.create",
    });

    const certification = await db.certificationDefinition.create({
      data: {
        organizationId: scope.organizationId,
        name,
        issuingOrganization: issuingOrganization || null,
        active: formData.has("active"),
      },
      select: {
        id: true,
        name: true,
        issuingOrganization: true,
        active: true,
      },
    });

    await writeAuditEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      action: "certification.definition.create",
      entityType: "certificationDefinition",
      entityId: certification.id,
      afterJson: JSON.stringify(certification),
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, { success: `Created certification ${certification.name}.` }),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "That certification already exists."
        : isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating certifications."
            : "Unable to create certification right now. Please try again.";

    return NextResponse.redirect(buildRedirectUrl(request.url, { error: message }), 303);
  }
}
