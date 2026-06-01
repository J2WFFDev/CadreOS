import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  guardianRelationshipWorkflowSchema,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(
  requestUrl: string,
  personId: string,
  relationshipId: string,
  input: {
    values: {
      guardianPersonId: string;
      relationshipType: string;
      guardianRole: string;
    };
    fieldErrors?: Partial<Record<"guardianPersonId" | "relationshipType" | "guardianRole", string>>;
    error?: string;
  },
) {
  const url = new URL(`/people/${personId}/guardians/${relationshipId}/edit`, requestUrl);

  url.searchParams.set("guardianPersonId", input.values.guardianPersonId);
  url.searchParams.set("relationshipType", input.values.relationshipType);
  url.searchParams.set("guardianRole", input.values.guardianRole);

  if (input.fieldErrors?.guardianPersonId) {
    url.searchParams.set("guardianPersonIdError", input.fieldErrors.guardianPersonId);
  }

  if (input.fieldErrors?.relationshipType) {
    url.searchParams.set("relationshipTypeError", input.fieldErrors.relationshipType);
  }

  if (input.fieldErrors?.guardianRole) {
    url.searchParams.set("guardianRoleError", input.fieldErrors.guardianRole);
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

function derivePermissionScope(person: {
  roles: Array<{ programId: string | null; teamId: string | null; team: { programId: string } | null }>;
  roster: Array<{ teamId: string; team: { programId: string } }>;
}) {
  const rosterScope = person.roster[0];
  const teamRoleScope = person.roles.find((role) => role.teamId && role.team?.programId);
  const programRoleScope = person.roles.find((role) => role.programId);

  return {
    teamId: rosterScope?.teamId ?? teamRoleScope?.teamId ?? null,
    programId:
      rosterScope?.team.programId ??
      programRoleScope?.programId ??
      teamRoleScope?.team?.programId ??
      null,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string; relationshipId: string }> },
) {
  const { personId, relationshipId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    guardianPersonId: getStringField(formData, "guardianPersonId"),
    relationshipType: getStringField(formData, "relationshipType"),
    guardianRole: getStringField(formData, "guardianRole"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, relationshipId, {
        values,
        error: scope.errorMessage ?? "Unable to update guardian relationship right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, relationshipId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = guardianRelationshipWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, relationshipId, {
        values,
        fieldErrors: {
          guardianPersonId: fieldErrors.guardianPersonId?.[0],
          relationshipType: fieldErrors.relationshipType?.[0],
          guardianRole: fieldErrors.guardianRole?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId: organizationId,
      },
      select: {
        id: true,
        roles: {
          select: {
            programId: true,
            teamId: true,
            team: {
              select: {
                programId: true,
              },
            },
          },
        },
        roster: {
          select: {
            teamId: true,
            team: {
              select: {
                programId: true,
              },
            },
          },
        },
      },
    });

    if (!person) {
      const missingPersonUrl = new URL(`/people/${personId}/guardians`, request.url);
      missingPersonUrl.searchParams.set("guardianError", "Person not found in the selected organization.");
      return NextResponse.redirect(missingPersonUrl, 303);
    }

    const permissionScope = derivePermissionScope(person);
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "guardianRelationship.update",
      programId: permissionScope.programId,
      teamId: permissionScope.teamId,
    });

    const relationship = await db.athleteGuardianRelationship.findFirst({
      where: {
        id: relationshipId,
        organizationId: organizationId,
        athletePersonId: person.id,
      },
      select: {
        id: true,
        athletePersonId: true,
        guardianPersonId: true,
        relationshipType: true,
        guardianRole: true,
      },
    });

    if (!relationship) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, relationshipId, {
          values,
          error: "Relationship not found for this person in the selected organization.",
        }),
        303,
      );
    }

    const guardian = await db.person.findFirst({
      where: {
        id: parsed.data.guardianPersonId,
        organizationId: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!guardian) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, relationshipId, {
          values,
          fieldErrors: {
            guardianPersonId: "Select a valid guardian in the active organization.",
          },
          error: "Guardian selection is invalid.",
        }),
        303,
      );
    }

    if (guardian.id === person.id) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, relationshipId, {
          values,
          fieldErrors: {
            guardianPersonId: "A person cannot be their own guardian relationship.",
          },
          error: "Self-relationship is not allowed.",
        }),
        303,
      );
    }

    const duplicatePair = await db.athleteGuardianRelationship.findFirst({
      where: {
        organizationId: organizationId,
        athletePersonId: person.id,
        guardianPersonId: guardian.id,
        id: { not: relationship.id },
      },
      select: {
        id: true,
        relationshipType: true,
        guardianRole: true,
      },
    });

    if (duplicatePair) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, relationshipId, {
          values,
          fieldErrors: {
            guardianPersonId: "This guardian is already linked for this athlete/member.",
          },
          error:
            duplicatePair.relationshipType === parsed.data.relationshipType
              ? "Duplicate guardian relationship is not allowed."
              : "This guardian is already linked with a different relationship type.",
        }),
        303,
      );
    }

    const updatedRelationship = await db.athleteGuardianRelationship.update({
      where: {
        id: relationship.id,
      },
      data: {
        guardianPersonId: guardian.id,
        relationshipType: parsed.data.relationshipType,
        guardianRole: parsed.data.guardianRole,
      },
      select: {
        id: true,
        athletePersonId: true,
        guardianPersonId: true,
        relationshipType: true,
        guardianRole: true,
      },
    });

    await writeAuditEvent({
      organizationId,
      actorPersonId: scope.auth.personId,
      action: "guardianRelationship.update",
      entityType: "athleteGuardianRelationship",
      entityId: updatedRelationship.id,
      beforeJson: JSON.stringify({
        athletePersonId: relationship.athletePersonId,
        guardianPersonId: relationship.guardianPersonId,
        relationshipType: relationship.relationshipType,
        guardianRole: relationship.guardianRole,
      }),
      afterJson: JSON.stringify({
        athletePersonId: updatedRelationship.athletePersonId,
        guardianPersonId: updatedRelationship.guardianPersonId,
        relationshipType: updatedRelationship.relationshipType,
        guardianRole: updatedRelationship.guardianRole,
      }),
    });

    const successUrl = new URL(`/people/${person.id}/guardians`, request.url);
    successUrl.searchParams.set("guardianSuccess", "Guardian relationship updated.");
    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, relationshipId, {
          values,
          error: "That guardian relationship already exists.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, relationshipId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before updating guardian relationships."
            : "Unable to update guardian relationship right now. Please try again.",
      }),
      303,
    );
  }
}
